package com.openstory.sdk.internal

import android.content.Context
import android.view.ViewGroup
import androidx.room.Room
import com.openstory.sdk.OpenStoryCallbacks
import com.openstory.sdk.OpenStoryConfiguration
import com.openstory.sdk.R
import com.openstory.sdk.internal.cache.OpenStoryDatabase
import com.openstory.sdk.internal.cache.StoryFeedCacheKey
import com.openstory.sdk.internal.cache.StoryFeedSnapshotEntity
import com.openstory.sdk.internal.cache.ViewedStorySession
import com.openstory.sdk.internal.cache.ViewedStoryStateRepository
import com.openstory.sdk.internal.cache.ViewedStoryStateSnapshot
import com.openstory.sdk.internal.context.AppVersionProvider
import com.openstory.sdk.internal.context.UserContextStore
import com.openstory.sdk.internal.network.OpenStoryApi
import com.openstory.sdk.internal.network.OpenStoryAuthorizationException
import com.openstory.sdk.internal.network.SdkFeedRequestPayload
import com.openstory.sdk.internal.network.SdkFeedResponsePayload
import com.openstory.sdk.internal.ui.StoryBarView
import com.openstory.sdk.internal.ui.StoryViewerDialog
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

internal class OpenStoryRuntime(
    context: Context,
    private val configuration: OpenStoryConfiguration,
    private val mainDispatcher: CoroutineDispatcher = Dispatchers.Main.immediate,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    private val appContext = context.applicationContext
    private val appVersionProvider = AppVersionProvider(appContext)
    private val userContextStore = UserContextStore()
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }
    private val api = OpenStoryApi(configuration, json)
    private val database = Room.databaseBuilder(
        appContext,
        OpenStoryDatabase::class.java,
        "open-story-android-sdk.db",
    ).build()
    private val viewedStoryStateRepository = ViewedStoryStateRepository(
        dao = database.viewedStoryRevisionDao(),
    )
    private val scope = CoroutineScope(SupervisorJob() + mainDispatcher)
    private val storyBarsByPlacement = ConcurrentHashMap<String, MutableSet<WeakReference<StoryBarView>>>()
    private val latestSnapshotsByPlacement = ConcurrentHashMap<String, SdkFeedResponsePayload>()
    private val reloadJobs = ConcurrentHashMap<String, Job>()

    fun updateUserContext(userSegments: Collection<String>) {
        userContextStore.update(userSegments)
    }

    fun renderStoryBar(
        placementKey: String,
        container: ViewGroup,
        callbacks: OpenStoryCallbacks,
    ) {
        scope.launch {
            val view = ensureStoryBarView(container)
            view.updateCallbacks(callbacks)
            view.updateViewerLauncher(viewerLauncher())
            register(placementKey, view)
            view.showLoading()
            startLoadPlacement(placementKey)
        }
    }

    fun reload(placementKey: String) {
        scope.launch {
            startLoadPlacement(placementKey)
        }
    }

    fun shutdown() {
        reloadJobs.values.forEach { it.cancel() }
        scope.cancel()
        database.close()
    }

    private fun startLoadPlacement(placementKey: String) {
        val requestPayload = buildRequestPayload(placementKey)
        val cacheKey = StoryFeedCacheKey.create(
            placementKey = placementKey,
            platform = requestPayload.platform,
            appVersion = requestPayload.appVersion,
            userSegments = requestPayload.userSegments,
        )

        reloadJobs.remove(placementKey)?.cancel()
        val job = scope.launch {
            val (cachedEntity, viewedState) = withContext(ioDispatcher) {
                val cachedEntity = database.storyFeedSnapshotDao().find(cacheKey.databaseKey)
                val viewedStateSnapshot = viewedStoryStateRepository.snapshot()
                cachedEntity to viewedStateSnapshot
            }
            val cachedSnapshot = withContext(ioDispatcher) {
                cachedEntity?.payloadJson?.let { payloadJson ->
                    runCatching {
                        json.decodeFromString<SdkFeedResponsePayload>(payloadJson)
                    }.getOrElse {
                        database.storyFeedSnapshotDao().delete(cacheKey.databaseKey)
                        null
                    }
                }
            }
            renderLoading(placementKey)

            try {
                val response = withContext(ioDispatcher) {
                    api.fetchFeed(requestPayload, configuration.staticToken)
                }

                withContext(ioDispatcher) {
                    val responseJson = json.encodeToString(response)
                    database.storyFeedSnapshotDao().upsert(
                        StoryFeedSnapshotEntity(
                            cacheKey = cacheKey.databaseKey,
                            placementKey = cacheKey.placementKey,
                            platform = cacheKey.platform,
                            appVersion = cacheKey.appVersion,
                            userSegmentsHash = cacheKey.userSegmentsHash,
                            payloadJson = responseJson,
                            updatedAtEpochMs = System.currentTimeMillis(),
                        ),
                    )
                }

                renderSnapshot(
                    placementKey = cacheKey.placementKey,
                    snapshot = response,
                    isCached = false,
                    viewedState = viewedStoryStateRepository.currentSnapshot(),
                )
            } catch (authorizationError: OpenStoryAuthorizationException) {
                withContext(ioDispatcher) {
                    database.storyFeedSnapshotDao().delete(cacheKey.databaseKey)
                }
                renderUnauthorized(placementKey)
                notifyError(placementKey, authorizationError)
            } catch (throwable: Throwable) {
                if (cachedSnapshot != null) {
                    renderSnapshot(
                        placementKey = cacheKey.placementKey,
                        snapshot = cachedSnapshot,
                        isCached = true,
                        viewedState = viewedState,
                    )
                } else {
                    renderError(placementKey)
                }
                notifyError(placementKey, throwable)
            }
        }
        reloadJobs[placementKey] = job
        job.invokeOnCompletion {
            reloadJobs.remove(placementKey, job)
        }
    }

    private fun buildRequestPayload(placementKey: String): SdkFeedRequestPayload {
        return SdkFeedRequestPayload(
            clientId = configuration.clientId,
            placementKey = placementKey.trim(),
            platform = "android",
            appVersion = appVersionProvider.versionName(),
            userSegments = userContextStore.snapshot(),
        )
    }

    private suspend fun renderSnapshot(
        placementKey: String,
        snapshot: SdkFeedResponsePayload,
        isCached: Boolean,
        viewedState: ViewedStoryStateSnapshot,
    ) {
        latestSnapshotsByPlacement[placementKey] = snapshot
        val targets = registeredViews(placementKey)
        withContext(mainDispatcher) {
            targets.forEach { it.renderSnapshot(snapshot, isCached, viewedState) }
        }
    }

    private suspend fun renderLoading(placementKey: String) {
        withContext(mainDispatcher) {
            registeredViews(placementKey).forEach { it.showLoading() }
        }
    }

    private suspend fun renderError(placementKey: String) {
        latestSnapshotsByPlacement.remove(placementKey)
        val message = appContext.getString(R.string.open_story_error)
        withContext(mainDispatcher) {
            registeredViews(placementKey).forEach { it.showEmpty(message) }
        }
    }

    private suspend fun renderUnauthorized(placementKey: String) {
        latestSnapshotsByPlacement.remove(placementKey)
        val message = appContext.getString(R.string.open_story_unauthorized)
        withContext(mainDispatcher) {
            registeredViews(placementKey).forEach { it.showEmpty(message) }
        }
    }

    private suspend fun notifyError(placementKey: String, throwable: Throwable) {
        withContext(mainDispatcher) {
            registeredViews(placementKey).forEach { it.dispatchError(placementKey, throwable) }
        }
    }

    private fun ensureStoryBarView(container: ViewGroup): StoryBarView {
        val existing = container.findViewWithTag<StoryBarView>(STORY_BAR_TAG)
        if (existing != null) {
            return existing
        }

        container.removeAllViews()
        return StoryBarView(container.context).also { view ->
            view.tag = STORY_BAR_TAG
            view.updateViewerLauncher(viewerLauncher())
            container.addView(
                view,
                ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
        }
    }

    private fun viewerLauncher(): StoryBarView.ViewerLauncher {
        return StoryBarView.ViewerLauncher { anchorContext, response, initialGroupIndex, group, callbacks ->
            val viewedStorySession = ViewedStorySession(
                initialSnapshot = viewedStoryStateRepository.currentSnapshot(),
                onStoryViewed = ::onStoryViewed,
            )
            val opened = StoryViewerDialog.show(
                anchorContext = anchorContext,
                response = response,
                initialGroupIndex = initialGroupIndex,
                initialStoryIndex = viewedStorySession.firstUnviewedStoryIndex(group),
                viewedStorySession = viewedStorySession,
                callbacks = callbacks,
            )

            if (!opened) {
                callbacks.onError(
                    response.placementKey,
                    IllegalStateException("Story viewer requires an Activity-backed context."),
                )
            }
        }
    }

    private fun onStoryViewed(storyRevisionId: String) {
        scope.launch {
            val inserted = withContext(ioDispatcher) {
                viewedStoryStateRepository.markViewed(storyRevisionId)
            }
            if (!inserted) {
                return@launch
            }

            refreshVisibleStoryBars()
        }
    }

    private suspend fun refreshVisibleStoryBars() {
        val viewedState = withContext(ioDispatcher) {
            viewedStoryStateRepository.snapshot()
        }

        latestSnapshotsByPlacement.forEach { (placementKey, snapshot) ->
            renderSnapshot(
                placementKey = placementKey,
                snapshot = snapshot,
                isCached = false,
                viewedState = viewedState,
            )
        }
    }

    private fun register(placementKey: String, storyBarView: StoryBarView) {
        storyBarsByPlacement.forEach { (registeredPlacementKey, refs) ->
            refs.removeAll { ref ->
                val view = ref.get()
                view == null || view == storyBarView
            }
            if (refs.isEmpty()) {
                storyBarsByPlacement.remove(registeredPlacementKey, refs)
            }
        }

        val set = storyBarsByPlacement.getOrPut(placementKey) { mutableSetOf() }
        set.removeAll { it.get() == null }
        set.add(WeakReference(storyBarView))
    }

    private fun registeredViews(placementKey: String): List<StoryBarView> {
        val refs = storyBarsByPlacement[placementKey].orEmpty()
        val active = refs.mapNotNull { it.get() }
        if (active.size != refs.size) {
            storyBarsByPlacement[placementKey]?.removeAll { it.get() == null }
        }
        return active
    }

    private companion object {
        const val STORY_BAR_TAG = "open_story_story_bar"
    }
}

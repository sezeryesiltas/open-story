package com.openstory.sdk.internal.ui

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.SystemClock
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.Window
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.core.view.setPadding
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.load
import com.openstory.sdk.OpenStoryCallbacks
import com.openstory.sdk.R
import com.openstory.sdk.internal.cache.ViewedStorySession
import com.openstory.sdk.internal.network.SdkFeedGroupPayload
import com.openstory.sdk.internal.network.SdkFeedResponsePayload
import com.openstory.sdk.internal.network.SdkFeedStoryPayload
import com.openstory.sdk.model.OpenStoryAnalyticsEvent
import com.openstory.sdk.model.OpenStoryCtaPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import kotlin.math.abs

internal class StoryViewerDialog private constructor(
    activity: Activity,
    private val response: SdkFeedResponsePayload,
    private val initialGroupIndex: Int,
    private val initialStoryIndex: Int,
    private val isCached: Boolean,
    private val viewedStorySession: ViewedStorySession,
    private val callbacks: OpenStoryCallbacks,
) : Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen) {
    private val groups = response.resolvedSet?.groups.orEmpty()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private val longPressTimeoutMs = ViewConfiguration.getLongPressTimeout().toLong()
    private val overlayTouchListener = View.OnTouchListener { _, event -> handleGestureTouch(event) }

    private lateinit var stageSurface: FrameLayout
    private lateinit var primaryStage: ViewerStage
    private lateinit var secondaryStage: ViewerStage
    private lateinit var activeStage: ViewerStage
    private lateinit var inactiveStage: ViewerStage
    private var currentGroupIndex = initialGroupIndex
    private var currentStoryIndex = initialStoryIndex
    private var currentPlayer: ExoPlayer? = null
    private var autoAdvanceJob: Job? = null
    private var videoProgressJob: Job? = null
    private var currentProgressAnimator: ValueAnimator? = null
    private var transitionAnimator: ValueAnimator? = null
    private var viewerClosedReported = false
    private var isMuted = true
    private var imageProgressState = StoryPlaybackProgressState.started(DEFAULT_IMAGE_DURATION_MS)
    private var storyPlaybackStartedAtMs = 0L
    private var currentStoryProgressFraction = 0f
    private var gestureMode = GestureMode.IDLE
    private var downX = 0f
    private var downY = 0f
    private var isTransitionRunning = false
    private var horizontalSwipeDirection: GroupDirection? = null
    private var currentTransition: GroupTransitionState? = null
    private val pauseReasons = linkedSetOf<PauseReason>()
    private val longPressRunnable = Runnable {
        if (gestureMode == GestureMode.PENDING) {
            gestureMode = GestureMode.LONG_PRESS
            addPauseReason(PauseReason.LONG_PRESS)
        }
    }
    private val mediaHost: FrameLayout
        get() = activeStage.mediaHost
    private val gestureOverlay: View
        get() = activeStage.gestureOverlay
    private val progressRow: LinearLayout
        get() = activeStage.progressRow
    private val soundButton: FrameLayout
        get() = activeStage.soundButton
    private val soundIconView: ImageView
        get() = activeStage.soundIconView
    private val ctaButton: TextView
        get() = activeStage.ctaButton
    private val progressFillViews: MutableList<View>
        get() = activeStage.progressFillViews

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window?.apply {
            setLayout(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
            )
            setBackgroundDrawableResource(android.R.color.black)
        }
        setCancelable(true)
        setCanceledOnTouchOutside(false)
        setContentView(buildContent())
        renderCurrentStory()
    }

    override fun dismiss() {
        cancelLongPressRecognition()
        stageSurface.animate().cancel()
        transitionAnimator?.cancel()
        transitionAnimator = null
        currentProgressAnimator?.cancel()
        currentProgressAnimator = null
        videoProgressJob?.cancel()
        videoProgressJob = null
        releasePlayback()
        autoAdvanceJob?.cancel()
        autoAdvanceJob = null
        if (!viewerClosedReported) {
            viewerClosedReported = true
            val group = currentGroupOrNull()
            val story = currentStoryOrNull()
            callbacks.onViewerClose(
                OpenStoryAnalyticsEvent(
                    kind = OpenStoryAnalyticsEvent.Kind.VIEWER_CLOSE,
                    placementKey = response.placementKey,
                    storyGroupId = group?.id,
                    storyGroupRevisionId = group?.revisionId,
                    storyId = story?.id,
                    storyRevisionId = story?.revisionId,
                ),
            )
        }
        scope.cancel()
        super.dismiss()
    }

    override fun onStart() {
        super.onStart()
        removePauseReason(PauseReason.BACKGROUND)
    }

    override fun onStop() {
        addPauseReason(PauseReason.BACKGROUND)
        super.onStop()
    }

    private data class ViewerStage(
        val root: FrameLayout,
        val mediaHost: FrameLayout,
        val gestureOverlay: View,
        val topChrome: LinearLayout,
        val progressRow: LinearLayout,
        val progressFillViews: MutableList<View>,
        val avatarRingView: GradientRingView,
        val avatarView: ImageView,
        val titleView: TextView,
        val soundButton: FrameLayout,
        val closeButton: FrameLayout,
        val soundIconView: ImageView,
        val ctaButton: TextView,
        val transitionShade: View,
    )

    private data class GroupTransitionState(
        val sourceStage: ViewerStage,
        val targetStage: ViewerStage,
        val targetGroupIndex: Int,
        val targetStoryIndex: Int,
        val direction: GroupDirection,
        var progress: Float = 0f,
    )

    private fun buildContent(): View {
        val root = FrameLayout(context).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        stageSurface = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            clipChildren = false
            clipToPadding = false
        }

        primaryStage = createViewerStage()
        secondaryStage = createViewerStage()
        activeStage = primaryStage
        inactiveStage = secondaryStage
        inactiveStage.root.isVisible = false

        stageSurface.addView(inactiveStage.root)
        stageSurface.addView(activeStage.root)
        root.addView(stageSurface)
        bindStageTouchHandling()

        return root
    }

    private fun createViewerStage(): ViewerStage {
        val avatarRingDiameterPx = dp(VIEWER_AVATAR_RING_DIAMETER_DP)
        val avatarImageDiameterPx = dp(VIEWER_AVATAR_IMAGE_DIAMETER_DP)
        val initialRingColors = storyAvatarRingColors(
            isViewed = false,
            isCached = isCached,
        )
        val stageRoot = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            cameraDistance = context.resources.displayMetrics.density * 12_000f
            setBackgroundColor(Color.BLACK)
        }
        val mediaHost = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(Color.parseColor("#050505"))
        }
        val gestureOverlay = View(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
        }
        val scrimTop = LinearGradientView(
            context = context,
            colors = intArrayOf(0xEB000000.toInt(), 0x00000000),
        )
        val scrimBottom = LinearGradientView(
            context = context,
            colors = intArrayOf(0x00000000, 0xF2000000.toInt()),
        )
        val progressRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        val avatarRingView = GradientRingView(
            context = context,
            startColor = initialRingColors.startColor,
            endColor = initialRingColors.endColor,
            strokeWidthPx = dp(VIEWER_AVATAR_RING_STROKE_WIDTH_DP).toFloat(),
        )
        val avatarView = circularImageView()
        val avatarHost = FrameLayout(context).apply {
            clipChildren = false
            clipToPadding = false
            addView(
                avatarRingView,
                FrameLayout.LayoutParams(
                    avatarRingDiameterPx,
                    avatarRingDiameterPx,
                    Gravity.CENTER,
                ),
            )
            addView(
                avatarView,
                FrameLayout.LayoutParams(
                    avatarImageDiameterPx,
                    avatarImageDiameterPx,
                    Gravity.CENTER,
                ),
            )
        }
        val titleView = TextView(context).apply {
            setTextColor(Color.WHITE)
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        val soundIconView = actionIcon(android.R.drawable.ic_lock_silent_mode)
        val soundButton = iconActionButton(
            icon = soundIconView,
            contentDescriptionText = context.getString(R.string.open_story_sound_off),
        ).apply {
            setOnClickListener {
                if (this@StoryViewerDialog.soundButton === this) {
                    toggleSound()
                }
            }
        }
        val closeButton = iconActionButton(
            icon = actionIcon(android.R.drawable.ic_menu_close_clear_cancel),
            contentDescriptionText = context.getString(R.string.open_story_close),
        ).apply {
            setOnClickListener { dismiss() }
        }

        val headerLeft = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(
                avatarHost,
                LinearLayout.LayoutParams(avatarRingDiameterPx, avatarRingDiameterPx),
            )
            addView(
                titleView,
                LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = dp(12)
                },
            )
        }
        val headerActions = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(soundButton)
            addView(
                closeButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply {
                    marginStart = dp(6)
                },
            )
        }
        val headerRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(
                headerLeft,
                LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f),
            )
            addView(headerActions)
        }
        val topChrome = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), 0, dp(18), 0)
            addView(
                progressRow,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
            addView(
                headerRow,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply {
                    topMargin = dp(6)
                },
            )
        }
        val ctaButton = TextView(context).apply {
            gravity = Gravity.CENTER
            minHeight = dp(40)
            minWidth = dp(160)
            setPadding(dp(28), dp(10), dp(28), dp(10))
            setTextColor(Color.BLACK)
            textSize = 16f
            setTypeface(typeface, Typeface.BOLD)
            background = pillBackground("#F7C948")
            isVisible = false
        }
        val transitionShade = View(context).apply {
            setBackgroundColor(Color.BLACK)
            alpha = 0f
        }

        stageRoot.addView(mediaHost)
        stageRoot.addView(gestureOverlay)
        stageRoot.addView(
            scrimTop,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(212),
                Gravity.TOP,
            ),
        )
        stageRoot.addView(
            scrimBottom,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(228),
                Gravity.BOTTOM,
            ),
        )
        stageRoot.addView(
            transitionShade,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            ),
        )
        stageRoot.addView(
            topChrome,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP,
            ),
        )
        stageRoot.addView(
            ctaButton,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
            ).apply {
                bottomMargin = dp(24)
            },
        )

        return ViewerStage(
            root = stageRoot,
            mediaHost = mediaHost,
            gestureOverlay = gestureOverlay,
            topChrome = topChrome,
            progressRow = progressRow,
            progressFillViews = mutableListOf(),
            avatarRingView = avatarRingView,
            avatarView = avatarView,
            titleView = titleView,
            soundButton = soundButton,
            closeButton = closeButton,
            soundIconView = soundIconView,
            ctaButton = ctaButton,
            transitionShade = transitionShade,
        )
    }

    private fun bindStageTouchHandling() {
        primaryStage.gestureOverlay.setOnTouchListener(
            if (primaryStage === activeStage) {
                overlayTouchListener
            } else {
                null
            },
        )
        secondaryStage.gestureOverlay.setOnTouchListener(
            if (secondaryStage === activeStage) {
                overlayTouchListener
            } else {
                null
            },
        )
    }

    private fun renderCurrentStory(reportStoryView: Boolean = true) {
        val group = currentGroupOrNull() ?: return dismiss()
        val story = currentStoryOrNull() ?: return dismiss()

        currentStoryProgressFraction = 0f
        bindStageHeader(activeStage, group)
        updateProgressIndicators(
            stage = activeStage,
            group = group,
            activeStoryIndex = currentStoryIndex,
            activeStoryRevisionId = story.revisionId,
            progressFraction = currentStoryProgressFraction,
        )
        renderMedia(story)
        bindCta(
            stage = activeStage,
            group = group,
            story = story,
            interactive = true,
        )
        updateChromeVisibility(animated = false)
        if (reportStoryView) {
            reportStoryView(group, story)
            updateAvatarRing(activeStage, group)
        }
    }

    private fun updateProgressIndicators(
        stage: ViewerStage,
        group: SdkFeedGroupPayload,
        activeStoryIndex: Int,
        activeStoryRevisionId: String,
        progressFraction: Float,
    ) {
        stage.progressRow.removeAllViews()
        stage.progressFillViews.clear()
        group.stories.forEachIndexed { storyIndex, candidate ->
            val fillView = View(context).apply {
                background = GradientDrawable().apply {
                    cornerRadius = dp(999).toFloat()
                    setColor(Color.WHITE)
                }
                scaleX = when {
                    storyIndex < activeStoryIndex -> 1f
                    candidate.revisionId == activeStoryRevisionId -> progressFraction
                    else -> 0f
                }
                pivotX = 0f
            }

            stage.progressRow.addView(
                FrameLayout(context).apply {
                    background = GradientDrawable().apply {
                        cornerRadius = dp(999).toFloat()
                        setColor(0x59FFFFFF)
                    }
                    addView(
                        fillView,
                        FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT,
                        ),
                    )
                },
                LinearLayout.LayoutParams(0, dp(3), 1f).apply {
                    if (stage.progressRow.childCount > 0) {
                        marginStart = dp(4)
                    }
                },
            )
            stage.progressFillViews += fillView
        }
    }

    private fun renderPreviewStage(
        stage: ViewerStage,
        groupIndex: Int,
        storyIndex: Int,
    ) {
        val group = groups.getOrNull(groupIndex) ?: return
        val story = group.stories.getOrNull(storyIndex) ?: return

        bindStageHeader(stage, group)
        updateProgressIndicators(
            stage = stage,
            group = group,
            activeStoryIndex = storyIndex,
            activeStoryRevisionId = story.revisionId,
            progressFraction = 0f,
        )
        renderPreviewMedia(stage, story)
        bindCta(
            stage = stage,
            group = group,
            story = story,
            interactive = false,
        )
        stage.soundButton.isVisible = story.mediaType == "video"
        updateSoundButton(stage)
        updateChromeVisibility(animated = false)
    }

    private fun bindStageHeader(
        stage: ViewerStage,
        group: SdkFeedGroupPayload,
    ) {
        stage.titleView.text = group.title
        stage.avatarView.load(group.logoUrl)
        updateAvatarRing(stage, group)
    }

    private fun updateAvatarRing(
        stage: ViewerStage,
        group: SdkFeedGroupPayload,
    ) {
        val ringColors = storyAvatarRingColors(
            isViewed = viewedStorySession.isGroupViewed(group),
            isCached = isCached,
        )
        stage.avatarRingView.updateColors(
            startColor = ringColors.startColor,
            endColor = ringColors.endColor,
        )
    }

    private fun renderMedia(story: SdkFeedStoryPayload) {
        currentProgressAnimator?.cancel()
        currentProgressAnimator = null
        videoProgressJob?.cancel()
        videoProgressJob = null
        autoAdvanceJob?.cancel()
        autoAdvanceJob = null
        releasePlayback()
        mediaHost.removeAllViews()
        imageProgressState = StoryPlaybackProgressState.started(DEFAULT_IMAGE_DURATION_MS)
        storyPlaybackStartedAtMs = 0L

        addMediaBackdrop(
            mediaHost = mediaHost,
            imageUrl = story.viewerBackdropImageUrl,
        )

        if (story.mediaType == "video") {
            val player = ExoPlayer.Builder(context).build().also { exoPlayer ->
                exoPlayer.setMediaItem(MediaItem.fromUri(story.asset.url))
                exoPlayer.repeatMode = Player.REPEAT_MODE_OFF
                exoPlayer.volume = if (isMuted) 0f else 1f
                exoPlayer.addListener(
                    object : Player.Listener {
                        override fun onPlaybackStateChanged(playbackState: Int) {
                            if (playbackState == Player.STATE_ENDED) {
                                updateCurrentStoryProgress(1f)
                                scope.launch {
                                    handleStoryCompletedByPlayback()
                                }
                            }
                        }
                    },
                )
                exoPlayer.prepare()
                exoPlayer.playWhenReady = pauseReasons.isEmpty()
            }
            currentPlayer = player

            val playerView = PlayerView(context).apply {
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                setShutterBackgroundColor(Color.TRANSPARENT)
                this.player = player
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                )
            }
            mediaHost.addView(playerView)
            soundButton.isVisible = true
            updateSoundButton(activeStage)
            startVideoProgressMonitoring(player, story)
            return
        }

        val imageView = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            load(story.asset.url)
        }
        mediaHost.addView(imageView)
        soundButton.isVisible = false
        imageProgressState = StoryPlaybackProgressState.started(story.imageDurationMs ?: DEFAULT_IMAGE_DURATION_MS)

        startImageAutoAdvanceIfEligible()
    }

    private fun renderPreviewMedia(
        stage: ViewerStage,
        story: SdkFeedStoryPayload,
    ) {
        stage.mediaHost.removeAllViews()
        addMediaBackdrop(
            mediaHost = stage.mediaHost,
            imageUrl = story.viewerBackdropImageUrl,
        )

        val imageView = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            load(story.posterAsset?.url ?: story.asset.url)
        }
        stage.mediaHost.addView(imageView)
    }

    private fun bindCta(
        stage: ViewerStage,
        group: SdkFeedGroupPayload,
        story: SdkFeedStoryPayload,
        interactive: Boolean,
    ) {
        val cta = story.cta
        stage.ctaButton.isVisible = cta != null
        if (cta == null) {
            stage.ctaButton.alpha = 0f
            stage.ctaButton.isEnabled = false
            stage.ctaButton.setOnClickListener(null)
            return
        }

        stage.ctaButton.text = cta.label
        stage.ctaButton.alpha = if (pauseReasons.contains(PauseReason.LONG_PRESS)) {
            0f
        } else {
            1f
        }
        stage.ctaButton.isEnabled = interactive && !pauseReasons.contains(PauseReason.LONG_PRESS)
        if (!interactive) {
            stage.ctaButton.setOnClickListener(null)
            return
        }

        stage.ctaButton.setOnClickListener {
            callbacks.onStoryCtaTap(
                OpenStoryCtaPayload(
                    placementKey = response.placementKey,
                    storyGroupId = group.id,
                    storyGroupRevisionId = group.revisionId,
                    storyId = story.id,
                    storyRevisionId = story.revisionId,
                    label = cta.label,
                    targetType = if (cta.type == "deeplink") {
                        OpenStoryCtaPayload.TargetType.DEEPLINK
                    } else {
                        OpenStoryCtaPayload.TargetType.URL
                    },
                    targetValue = cta.value,
                ),
            )
            dismiss()
        }
    }

    private fun reportStoryView(
        group: SdkFeedGroupPayload,
        story: SdkFeedStoryPayload,
    ) {
        viewedStorySession.markStoryViewed(story.revisionId)
        callbacks.onStoryView(
            OpenStoryAnalyticsEvent(
                kind = OpenStoryAnalyticsEvent.Kind.STORY_VIEW,
                placementKey = response.placementKey,
                storyGroupId = group.id,
                storyGroupRevisionId = group.revisionId,
                storyId = story.id,
                storyRevisionId = story.revisionId,
            ),
        )
    }

    private suspend fun handleStoryCompletedByPlayback() {
        val group = currentGroupOrNull() ?: return
        val story = currentStoryOrNull() ?: return

        callbacks.onStoryComplete(
            OpenStoryAnalyticsEvent(
                kind = OpenStoryAnalyticsEvent.Kind.STORY_COMPLETE,
                placementKey = response.placementKey,
                storyGroupId = group.id,
                storyGroupRevisionId = group.revisionId,
                storyId = story.id,
                storyRevisionId = story.revisionId,
            ),
        )

        val atLastStoryInGroup = currentStoryIndex == group.stories.lastIndex
        if (atLastStoryInGroup) {
            callbacks.onGroupComplete(
                OpenStoryAnalyticsEvent(
                    kind = OpenStoryAnalyticsEvent.Kind.GROUP_COMPLETE,
                    placementKey = response.placementKey,
                    storyGroupId = group.id,
                    storyGroupRevisionId = group.revisionId,
                ),
            )
        }

        navigateForward(manual = false)
    }

    private fun navigateBackward() {
        if (currentStoryIndex > 0) {
            currentStoryIndex -= 1
            renderCurrentStory()
            return
        }

        if (currentGroupIndex <= 0) {
            return
        }

        navigateToGroup(
            targetGroupIndex = currentGroupIndex - 1,
            targetStoryIndex = groups[currentGroupIndex - 1].stories.lastIndex.coerceAtLeast(0),
            direction = GroupDirection.BACKWARD,
        )
    }

    private fun navigateForward(manual: Boolean) {
        val group = currentGroupOrNull() ?: return dismiss()
        val hasNextStory = currentStoryIndex < group.stories.lastIndex
        if (hasNextStory) {
            currentStoryIndex += 1
            renderCurrentStory()
            return
        }

        if (currentGroupIndex < groups.lastIndex) {
            navigateToGroup(
                targetGroupIndex = currentGroupIndex + 1,
                targetStoryIndex = viewedStorySession.firstUnviewedStoryIndex(groups[currentGroupIndex + 1]),
                direction = GroupDirection.FORWARD,
            )
            return
        }

        if (!manual) {
            dismiss()
        }
    }

    private fun navigateToGroup(
        targetGroupIndex: Int,
        targetStoryIndex: Int,
        direction: GroupDirection,
    ) {
        if (targetGroupIndex !in groups.indices || isTransitionRunning) {
            return
        }

        val targetGroup = groups[targetGroupIndex]
        val clampedTargetStoryIndex = targetStoryIndex.coerceIn(0, targetGroup.stories.lastIndex.coerceAtLeast(0))
        if (stageSurface.width == 0) {
            currentGroupIndex = targetGroupIndex
            currentStoryIndex = clampedTargetStoryIndex
            renderCurrentStory()
            return
        }

        if (!beginGroupTransition(
                targetGroupIndex = targetGroupIndex,
                targetStoryIndex = clampedTargetStoryIndex,
                direction = direction,
            )
        ) {
            return
        }

        animateCurrentTransitionTo(1f)
    }

    private fun beginGroupTransition(
        targetGroupIndex: Int,
        targetStoryIndex: Int,
        direction: GroupDirection,
    ): Boolean {
        if (targetGroupIndex !in groups.indices) {
            return false
        }

        val existingTransition = currentTransition
        if (existingTransition != null) {
            return existingTransition.targetGroupIndex == targetGroupIndex &&
                existingTransition.targetStoryIndex == targetStoryIndex &&
                existingTransition.direction == direction
        }

        transitionAnimator?.cancel()
        stageSurface.animate().cancel()
        isTransitionRunning = true
        addPauseReason(PauseReason.TRANSITION)
        inactiveStage.root.isVisible = true
        renderPreviewStage(
            stage = inactiveStage,
            groupIndex = targetGroupIndex,
            storyIndex = targetStoryIndex,
        )

        currentTransition = GroupTransitionState(
            sourceStage = activeStage,
            targetStage = inactiveStage,
            targetGroupIndex = targetGroupIndex,
            targetStoryIndex = targetStoryIndex,
            direction = direction,
        )
        applyGroupTransitionProgress(0f)
        return true
    }

    private fun updateInteractiveGroupTransition(deltaX: Float): Boolean {
        val direction = if (deltaX < 0f) {
            GroupDirection.FORWARD
        } else {
            GroupDirection.BACKWARD
        }
        val targetGroupIndex = if (direction == GroupDirection.FORWARD) {
            currentGroupIndex + 1
        } else {
            currentGroupIndex - 1
        }
        if (targetGroupIndex !in groups.indices) {
            return false
        }

        val targetStoryIndex = if (direction == GroupDirection.FORWARD) {
            viewedStorySession.firstUnviewedStoryIndex(groups[targetGroupIndex])
        } else {
            groups[targetGroupIndex].stories.lastIndex.coerceAtLeast(0)
        }
        if (!beginGroupTransition(targetGroupIndex, targetStoryIndex, direction)) {
            return false
        }

        horizontalSwipeDirection = direction
        val progress = (abs(deltaX) / stageSurface.width.coerceAtLeast(1).toFloat()).coerceIn(0f, 1f)
        applyGroupTransitionProgress(progress)
        return true
    }

    private fun animateCurrentTransitionTo(targetProgress: Float) {
        val transition = currentTransition ?: return
        transitionAnimator?.cancel()
        val startProgress = transition.progress
        transitionAnimator = ValueAnimator.ofFloat(startProgress, targetProgress).apply {
            duration = (GROUP_TRANSITION_DURATION_MS * abs(targetProgress - startProgress))
                .toLong()
                .coerceAtLeast(MIN_GROUP_TRANSITION_DURATION_MS)
            interpolator = DecelerateInterpolator()
            addUpdateListener { animator ->
                applyGroupTransitionProgress(animator.animatedValue as Float)
            }
            addListener(
                object : AnimatorListenerAdapter() {
                    private var wasCancelled = false

                    override fun onAnimationCancel(animation: Animator) {
                        wasCancelled = true
                    }

                    override fun onAnimationEnd(animation: Animator) {
                        if (wasCancelled) {
                            return
                        }
                        transitionAnimator = null
                        if (abs(targetProgress - 1f) < 0.0001f) {
                            finishCurrentTransition()
                        } else {
                            cancelCurrentTransition()
                        }
                    }
                },
            )
            start()
        }
    }

    private fun applyGroupTransitionProgress(progress: Float) {
        val transition = currentTransition ?: return
        val clampedProgress = progress.coerceIn(0f, 1f)
        transition.progress = clampedProgress
        transition.sourceStage.root.isVisible = true
        transition.targetStage.root.isVisible = true
        applyCubeTransform(
            stage = transition.sourceStage,
            position = if (transition.direction == GroupDirection.FORWARD) {
                -clampedProgress
            } else {
                clampedProgress
            },
        )
        applyCubeTransform(
            stage = transition.targetStage,
            position = if (transition.direction == GroupDirection.FORWARD) {
                1f - clampedProgress
            } else {
                clampedProgress - 1f
            },
        )
        if (clampedProgress < 0.5f) {
            transition.sourceStage.root.bringToFront()
        } else {
            transition.targetStage.root.bringToFront()
        }
    }

    private fun applyCubeTransform(
        stage: ViewerStage,
        position: Float,
    ) {
        stage.root.pivotY = stage.root.height / 2f
        stage.root.pivotX = if (position < 0f) {
            stage.root.width.toFloat()
        } else {
            0f
        }
        stage.root.translationX = stage.root.width * position
        stage.root.rotationY = CUBE_ROTATION_DEGREES * position
        stage.transitionShade.alpha = (abs(position) * CUBE_SHADE_MAX_ALPHA).coerceIn(0f, CUBE_SHADE_MAX_ALPHA)
    }

    private fun finishCurrentTransition() {
        val transition = currentTransition ?: return
        currentGroupIndex = transition.targetGroupIndex
        currentStoryIndex = transition.targetStoryIndex
        activeStage = transition.targetStage
        inactiveStage = transition.sourceStage
        bindStageTouchHandling()
        activeStage.root.bringToFront()
        resetStageTransform(activeStage)
        resetStageTransform(inactiveStage)
        inactiveStage.root.isVisible = false
        currentTransition = null
        horizontalSwipeDirection = null
        isTransitionRunning = false
        renderCurrentStory()
        removePauseReason(PauseReason.TRANSITION)
    }

    private fun cancelCurrentTransition() {
        val transition = currentTransition ?: return
        resetStageTransform(transition.sourceStage)
        resetStageTransform(transition.targetStage)
        activeStage.root.bringToFront()
        transition.targetStage.root.isVisible = false
        currentTransition = null
        horizontalSwipeDirection = null
        isTransitionRunning = false
        bindStageTouchHandling()
        removePauseReason(PauseReason.TRANSITION)
    }

    private fun resetStageTransform(stage: ViewerStage) {
        stage.root.translationX = 0f
        stage.root.rotationY = 0f
        stage.root.pivotX = stage.root.width / 2f
        stage.root.pivotY = stage.root.height / 2f
        stage.transitionShade.alpha = 0f
    }

    private fun toggleSound() {
        isMuted = !isMuted
        currentPlayer?.volume = if (isMuted) 0f else 1f
        updateSoundButton(activeStage)
    }

    private fun handleGestureTouch(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                if (isTransitionRunning) {
                    return true
                }
                downX = event.x
                downY = event.y
                horizontalSwipeDirection = null
                gestureMode = GestureMode.PENDING
                startLongPressRecognition()
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                val deltaX = event.x - downX
                val deltaY = event.y - downY

                if (gestureMode == GestureMode.PENDING) {
                    if (abs(deltaY) > touchSlop && abs(deltaY) > abs(deltaX)) {
                        gestureMode = GestureMode.VERTICAL_DRAG
                        cancelLongPressRecognition()
                    } else if (abs(deltaX) > touchSlop && abs(deltaX) > abs(deltaY)) {
                        gestureMode = GestureMode.HORIZONTAL_SWIPE
                        cancelLongPressRecognition()
                    }
                }

                if (gestureMode == GestureMode.VERTICAL_DRAG) {
                    val translationY = deltaY.coerceAtLeast(0f)
                    stageSurface.translationY = translationY
                    stageSurface.alpha = (1f - (translationY / (stageSurface.height.coerceAtLeast(1) * 0.45f))).coerceIn(0.65f, 1f)
                } else if (gestureMode == GestureMode.HORIZONTAL_SWIPE) {
                    updateInteractiveGroupTransition(deltaX)
                }
                return true
            }

            MotionEvent.ACTION_UP -> {
                val deltaX = event.x - downX
                val deltaY = event.y - downY
                val handled = when (gestureMode) {
                    GestureMode.LONG_PRESS -> {
                        removePauseReason(PauseReason.LONG_PRESS)
                        true
                    }

                    GestureMode.VERTICAL_DRAG -> {
                        if (stageSurface.translationY >= swipeDismissThresholdPx()) {
                            dismiss()
                        } else {
                            resetStageSurfacePosition()
                        }
                        true
                    }

                    GestureMode.HORIZONTAL_SWIPE -> {
                        val transition = currentTransition
                        if (transition != null) {
                            if (transition.progress >= interactiveGroupSwipeCompletionThreshold()) {
                                animateCurrentTransitionTo(1f)
                            } else {
                                animateCurrentTransitionTo(0f)
                            }
                        }
                        true
                    }

                    else -> {
                        if (abs(deltaX) <= touchSlop && abs(deltaY) <= touchSlop) {
                            if (event.x < gestureOverlay.width / 2f) {
                                navigateBackward()
                            } else {
                                navigateForward(manual = true)
                            }
                        }
                        true
                    }
                }

                cancelLongPressRecognition()
                gestureMode = GestureMode.IDLE
                return handled
            }

            MotionEvent.ACTION_CANCEL -> {
                if (gestureMode == GestureMode.LONG_PRESS) {
                    removePauseReason(PauseReason.LONG_PRESS)
                }
                cancelLongPressRecognition()
                if (gestureMode == GestureMode.VERTICAL_DRAG) {
                    resetStageSurfacePosition()
                } else if (gestureMode == GestureMode.HORIZONTAL_SWIPE) {
                    animateCurrentTransitionTo(0f)
                }
                horizontalSwipeDirection = null
                gestureMode = GestureMode.IDLE
                return true
            }
        }

        return false
    }

    private fun startLongPressRecognition() {
        cancelLongPressRecognition()
        gestureOverlay.postDelayed(longPressRunnable, longPressTimeoutMs)
    }

    private fun cancelLongPressRecognition() {
        if (::activeStage.isInitialized) {
            gestureOverlay.removeCallbacks(longPressRunnable)
        }
    }

    private fun resetStageSurfacePosition() {
        stageSurface.animate()
            .translationY(0f)
            .alpha(1f)
            .setDuration(180L)
            .setListener(null)
            .start()
    }

    private fun addPauseReason(reason: PauseReason) {
        if (!pauseReasons.add(reason)) {
            return
        }

        applyPauseState()
    }

    private fun removePauseReason(reason: PauseReason) {
        if (!pauseReasons.remove(reason)) {
            return
        }

        applyPauseState()
    }

    private fun applyPauseState() {
        updateChromeVisibility(animated = true)
        if (pauseReasons.isEmpty()) {
            resumeCurrentStory()
        } else {
            pauseCurrentStory()
        }
    }

    private fun updateChromeVisibility(animated: Boolean) {
        val shouldHideChrome = pauseReasons.contains(PauseReason.LONG_PRESS)
        val chromeAlpha = if (shouldHideChrome) 0f else 1f

        listOf(activeStage, inactiveStage).forEach { stage ->
            if (animated) {
                stage.topChrome.animate()
                    .alpha(chromeAlpha)
                    .setDuration(CHROME_VISIBILITY_ANIMATION_DURATION_MS)
                    .start()

                stage.ctaButton.animate()
                    .alpha(
                        if (stage.ctaButton.isVisible && !shouldHideChrome) {
                            1f
                        } else {
                            0f
                        },
                    ).setDuration(CHROME_VISIBILITY_ANIMATION_DURATION_MS)
                    .start()
            } else {
                stage.topChrome.alpha = chromeAlpha
                stage.ctaButton.alpha = if (stage.ctaButton.isVisible && !shouldHideChrome) {
                    1f
                } else {
                    0f
                }
            }

            stage.soundButton.isEnabled = !shouldHideChrome && stage.soundButton.isVisible
            stage.closeButton.isEnabled = !shouldHideChrome
            stage.ctaButton.isEnabled =
                stage.ctaButton.isVisible && !shouldHideChrome && stage.ctaButton.hasOnClickListeners()
        }
    }

    private fun pauseCurrentStory() {
        val story = currentStoryOrNull() ?: return
        if (story.mediaType == "video") {
            currentPlayer?.playWhenReady = false
            return
        }

        if (autoAdvanceJob != null) {
            val elapsedMs = (SystemClock.elapsedRealtime() - storyPlaybackStartedAtMs).coerceAtLeast(0L)
            imageProgressState = imageProgressState.afterElapsed(elapsedMs)
            currentStoryProgressFraction = imageProgressState.fractionCompleted()
            updateCurrentStoryProgress(currentStoryProgressFraction)
            autoAdvanceJob?.cancel()
            autoAdvanceJob = null
            currentProgressAnimator?.cancel()
            currentProgressAnimator = null
            storyPlaybackStartedAtMs = 0L
        }
    }

    private fun resumeCurrentStory() {
        val story = currentStoryOrNull() ?: return
        if (story.mediaType == "video") {
            currentPlayer?.playWhenReady = true
            return
        }

        startImageAutoAdvanceIfEligible()
    }

    private fun startImageAutoAdvanceIfEligible() {
        if (pauseReasons.isNotEmpty() || autoAdvanceJob != null) {
            return
        }

        val delayMs = imageProgressState.remainingDurationMs.coerceAtLeast(1L)
        storyPlaybackStartedAtMs = SystemClock.elapsedRealtime()
        startImageProgressAnimation(delayMs)
        autoAdvanceJob = scope.launch {
            delay(delayMs)
            imageProgressState = imageProgressState.afterElapsed(delayMs)
            storyPlaybackStartedAtMs = 0L
            currentStoryProgressFraction = 1f
            updateCurrentStoryProgress(1f)
            handleStoryCompletedByPlayback()
        }
    }

    private fun releasePlayback() {
        currentPlayer?.release()
        currentPlayer = null
    }

    private fun currentGroupOrNull(): SdkFeedGroupPayload? = groups.getOrNull(currentGroupIndex)

    private fun currentStoryOrNull(): SdkFeedStoryPayload? =
        currentGroupOrNull()?.stories?.getOrNull(currentStoryIndex)

    private fun addMediaBackdrop(
        mediaHost: FrameLayout,
        imageUrl: String?,
    ) {
        if (imageUrl.isNullOrBlank()) {
            return
        }

        mediaHost.addView(
            ImageView(context).apply {
                alpha = 0.28f
                scaleType = ImageView.ScaleType.CENTER_CROP
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                )
                load(imageUrl)
            },
        )
        mediaHost.addView(
            View(context).apply {
                setBackgroundColor(0x3B000000)
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                )
            },
        )
    }

    private fun startImageProgressAnimation(durationMs: Long) {
        currentProgressAnimator?.cancel()
        val startFraction = imageProgressState.fractionCompleted()
        currentStoryProgressFraction = startFraction
        updateCurrentStoryProgress(startFraction)
        currentProgressAnimator = ValueAnimator.ofFloat(startFraction, 1f).apply {
            duration = durationMs.coerceAtLeast(1L)
            interpolator = LinearInterpolator()
            addUpdateListener { animator ->
                val animatedFraction = animator.animatedValue as Float
                currentStoryProgressFraction = animatedFraction
                updateCurrentStoryProgress(animatedFraction)
            }
            start()
        }
    }

    private fun startVideoProgressMonitoring(
        player: ExoPlayer,
        story: SdkFeedStoryPayload,
    ) {
        updateCurrentStoryProgress(0f)
        videoProgressJob = scope.launch {
            while (isActive && currentPlayer === player) {
                val durationMs = player.duration
                    .takeIf { it > 0L }
                    ?: story.asset.durationMs
                    ?: 0L
                if (durationMs > 0L) {
                    val fraction = (player.currentPosition.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
                    currentStoryProgressFraction = fraction
                    updateCurrentStoryProgress(fraction)
                }
                delay(VIDEO_PROGRESS_UPDATE_INTERVAL_MS)
            }
        }
    }

    private fun updateCurrentStoryProgress(fraction: Float) {
        progressFillViews.forEachIndexed { index, fillView ->
            fillView.scaleX = when {
                index < currentStoryIndex -> 1f
                index == currentStoryIndex -> fraction.coerceIn(0f, 1f)
                else -> 0f
            }
        }
    }

    private fun updateSoundButton(stage: ViewerStage = activeStage) {
        stage.soundIconView.setImageResource(
            if (isMuted) {
                android.R.drawable.ic_lock_silent_mode
            } else {
                android.R.drawable.ic_lock_silent_mode_off
            },
        )
        stage.soundButton.contentDescription = context.getString(
            if (isMuted) {
                R.string.open_story_sound_off
            } else {
                R.string.open_story_sound_on
            },
        )
    }

    private fun iconActionButton(
        icon: ImageView,
        contentDescriptionText: String,
    ): FrameLayout {
        return FrameLayout(context).apply {
            contentDescription = contentDescriptionText
            foreground = null
            background = pillBackground("#59000000")
            addView(
                icon,
                FrameLayout.LayoutParams(dp(16), dp(16), Gravity.CENTER),
            )
            layoutParams = FrameLayout.LayoutParams(dp(34), dp(34))
            minimumWidth = dp(34)
            minimumHeight = dp(34)
        }
    }

    private fun actionIcon(iconRes: Int): ImageView {
        return ImageView(context).apply {
            setImageResource(iconRes)
            setColorFilter(Color.WHITE)
        }
    }

    private fun circularImageView(): ImageView {
        return ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.DKGRAY)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                outlineProvider = object : ViewOutlineProvider() {
                    override fun getOutline(view: View, outline: Outline) {
                        outline.setOval(0, 0, view.width, view.height)
                    }
                }
                clipToOutline = true
            }
        }
    }

    private fun pillBackground(colorHex: String): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(999).toFloat()
            setColor(Color.parseColor(colorHex))
        }
    }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    private fun dp(value: Float): Int =
        (value * context.resources.displayMetrics.density).toInt()

    private fun swipeDismissThresholdPx(): Float = dp(120).toFloat()

    private fun groupSwipeThresholdPx(): Float = dp(56).toFloat()

    private fun interactiveGroupSwipeCompletionThreshold(): Float =
        groupSwipeThresholdPx() / stageSurface.width.coerceAtLeast(1).toFloat()

    companion object {
        private const val CHROME_VISIBILITY_ANIMATION_DURATION_MS = 180L
        private const val VIEWER_AVATAR_IMAGE_DIAMETER_DP = 40f
        private val VIEWER_AVATAR_RING_DIAMETER_DP =
            storyAvatarRingDiameterDpForImage(VIEWER_AVATAR_IMAGE_DIAMETER_DP)
        private val VIEWER_AVATAR_RING_STROKE_WIDTH_DP =
            storyAvatarRingStrokeWidthDpForImage(VIEWER_AVATAR_IMAGE_DIAMETER_DP)

        fun show(
            anchorContext: Context,
            response: SdkFeedResponsePayload,
            initialGroupIndex: Int,
            initialStoryIndex: Int,
            isCached: Boolean,
            viewedStorySession: ViewedStorySession,
            callbacks: OpenStoryCallbacks,
        ): Boolean {
            val activity = anchorContext.findActivity() ?: return false
            if (activity.isFinishing || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed)) {
                return false
            }

            StoryViewerDialog(
                activity = activity,
                response = response,
                initialGroupIndex = initialGroupIndex,
                initialStoryIndex = initialStoryIndex,
                isCached = isCached,
                viewedStorySession = viewedStorySession,
                callbacks = callbacks,
            ).show()
            return true
        }

        private const val DEFAULT_IMAGE_DURATION_MS = 5_000L
        private const val VIDEO_PROGRESS_UPDATE_INTERVAL_MS = 33L
        private const val GROUP_TRANSITION_DURATION_MS = 320f
        private const val MIN_GROUP_TRANSITION_DURATION_MS = 120L
        private const val CUBE_ROTATION_DEGREES = 92f
        private const val CUBE_SHADE_MAX_ALPHA = 0.22f
    }

    private enum class PauseReason {
        BACKGROUND,
        LONG_PRESS,
        TRANSITION,
    }

    private enum class GestureMode {
        IDLE,
        PENDING,
        LONG_PRESS,
        HORIZONTAL_SWIPE,
        VERTICAL_DRAG,
    }

    private enum class GroupDirection {
        FORWARD,
        BACKWARD,
    }
}

private fun Context.findActivity(): Activity? {
    var currentContext: Context? = this
    while (currentContext is ContextWrapper) {
        if (currentContext is Activity) {
            return currentContext
        }
        currentContext = currentContext.baseContext
    }
    return null
}

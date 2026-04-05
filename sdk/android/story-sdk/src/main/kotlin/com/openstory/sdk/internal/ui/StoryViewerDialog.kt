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
    private val viewedStorySession: ViewedStorySession,
    private val callbacks: OpenStoryCallbacks,
) : Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen) {
    private val groups = response.resolvedSet?.groups.orEmpty()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private val longPressTimeoutMs = ViewConfiguration.getLongPressTimeout().toLong()

    private lateinit var stageSurface: FrameLayout
    private lateinit var mediaHost: FrameLayout
    private lateinit var gestureOverlay: View
    private lateinit var scrimTop: View
    private lateinit var scrimBottom: View
    private lateinit var progressRow: LinearLayout
    private lateinit var avatarView: ImageView
    private lateinit var titleView: TextView
    private lateinit var soundButton: FrameLayout
    private lateinit var soundIconView: ImageView
    private lateinit var closeButton: FrameLayout
    private lateinit var ctaButton: TextView

    private val progressFillViews = mutableListOf<View>()
    private var currentGroupIndex = initialGroupIndex
    private var currentStoryIndex = initialStoryIndex
    private var currentPlayer: ExoPlayer? = null
    private var autoAdvanceJob: Job? = null
    private var videoProgressJob: Job? = null
    private var currentProgressAnimator: ValueAnimator? = null
    private var viewerClosedReported = false
    private var isMuted = true
    private var imageProgressState = StoryPlaybackProgressState.started(DEFAULT_IMAGE_DURATION_MS)
    private var storyPlaybackStartedAtMs = 0L
    private var currentStoryProgressFraction = 0f
    private var gestureMode = GestureMode.IDLE
    private var downX = 0f
    private var downY = 0f
    private var isTransitionRunning = false
    private val pauseReasons = linkedSetOf<PauseReason>()
    private val longPressRunnable = Runnable {
        if (gestureMode == GestureMode.PENDING) {
            gestureMode = GestureMode.LONG_PRESS
            addPauseReason(PauseReason.LONG_PRESS)
        }
    }

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
            cameraDistance = context.resources.displayMetrics.density * 12_000f
        }

        mediaHost = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(Color.parseColor("#050505"))
        }

        gestureOverlay = View(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            setOnTouchListener { _, event -> handleGestureTouch(event) }
        }

        scrimTop = View(context).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0xD9000000.toInt(), 0x14000000),
            )
        }
        scrimBottom = View(context).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0x00000000, 0xF2000000.toInt()),
            )
        }

        progressRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
        }

        avatarView = circularImageView(sizeDp = 40)
        titleView = TextView(context).apply {
            setTextColor(Color.WHITE)
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }

        soundIconView = actionIcon(android.R.drawable.ic_lock_silent_mode)
        soundButton = iconActionButton(
            icon = soundIconView,
            contentDescriptionText = context.getString(R.string.open_story_sound_off),
        ).apply {
            setOnClickListener { toggleSound() }
        }
        closeButton = iconActionButton(
            icon = actionIcon(android.R.drawable.ic_menu_close_clear_cancel),
            contentDescriptionText = context.getString(R.string.open_story_close),
        ).apply {
            setOnClickListener { dismiss() }
        }

        val headerLeft = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(avatarView)
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
                    marginStart = dp(10)
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
            setPadding(dp(16))
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
                    topMargin = dp(16)
                },
            )
        }

        ctaButton = TextView(context).apply {
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

        stageSurface.addView(mediaHost)
        stageSurface.addView(gestureOverlay)
        stageSurface.addView(
            scrimTop,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(212),
                Gravity.TOP,
            ),
        )
        stageSurface.addView(
            scrimBottom,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(228),
                Gravity.BOTTOM,
            ),
        )
        stageSurface.addView(
            topChrome,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP,
            ),
        )
        stageSurface.addView(
            ctaButton,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
            ).apply {
                bottomMargin = dp(28)
            },
        )
        root.addView(stageSurface)

        return root
    }

    private fun renderCurrentStory() {
        val group = currentGroupOrNull() ?: return dismiss()
        val story = currentStoryOrNull() ?: return dismiss()

        currentStoryProgressFraction = 0f
        titleView.text = group.title
        avatarView.load(group.logoUrl)
        updateProgressIndicators(group, story)
        renderMedia(story)
        bindCta(group, story)
        reportStoryView(group, story)
    }

    private fun updateProgressIndicators(
        group: SdkFeedGroupPayload,
        story: SdkFeedStoryPayload,
    ) {
        progressRow.removeAllViews()
        progressFillViews.clear()
        group.stories.forEachIndexed { storyIndex, candidate ->
            val fillView = View(context).apply {
                background = GradientDrawable().apply {
                    cornerRadius = dp(999).toFloat()
                    setColor(Color.WHITE)
                }
                scaleX = when {
                    storyIndex < currentStoryIndex -> 1f
                    candidate.revisionId == story.revisionId -> currentStoryProgressFraction
                    else -> 0f
                }
                pivotX = 0f
            }

            progressRow.addView(
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
                    if (progressRow.childCount > 0) {
                        marginStart = dp(4)
                    }
                },
            )
            progressFillViews += fillView
        }
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
            imageUrl = story.posterAsset?.url ?: story.asset.url,
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
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                setShutterBackgroundColor(Color.TRANSPARENT)
                this.player = player
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                )
            }
            mediaHost.addView(playerView)
            soundButton.isVisible = true
            updateSoundButton()
            startVideoProgressMonitoring(player, story)
            return
        }

        val imageView = ImageView(context).apply {
            scaleType = ImageView.ScaleType.FIT_START
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

    private fun bindCta(
        group: SdkFeedGroupPayload,
        story: SdkFeedStoryPayload,
    ) {
        val cta = story.cta
        ctaButton.isVisible = cta != null
        if (cta == null) {
            ctaButton.setOnClickListener(null)
            return
        }

        ctaButton.text = cta.label
        ctaButton.setOnClickListener {
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

    private fun navigateToNextGroupBySwipe() {
        if (currentGroupIndex >= groups.lastIndex) {
            return
        }

        navigateToGroup(
            targetGroupIndex = currentGroupIndex + 1,
            targetStoryIndex = viewedStorySession.firstUnviewedStoryIndex(groups[currentGroupIndex + 1]),
            direction = GroupDirection.FORWARD,
        )
    }

    private fun navigateToPreviousGroupBySwipe() {
        if (currentGroupIndex <= 0) {
            return
        }

        navigateToGroup(
            targetGroupIndex = currentGroupIndex - 1,
            targetStoryIndex = groups[currentGroupIndex - 1].stories.lastIndex.coerceAtLeast(0),
            direction = GroupDirection.BACKWARD,
        )
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

        isTransitionRunning = true
        addPauseReason(PauseReason.TRANSITION)
        stageSurface.animate().cancel()

        val exitRotation = if (direction == GroupDirection.FORWARD) {
            -32f
        } else {
            32f
        }
        val enterRotation = -exitRotation
        val travelDistance = stageSurface.width * 0.18f

        stageSurface.animate()
            .rotationY(exitRotation)
            .translationX(if (direction == GroupDirection.FORWARD) -travelDistance else travelDistance)
            .alpha(0.86f)
            .setDuration(140L)
            .setListener(
                object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        currentGroupIndex = targetGroupIndex
                        currentStoryIndex = clampedTargetStoryIndex
                        renderCurrentStory()

                        stageSurface.rotationY = enterRotation
                        stageSurface.translationX = if (direction == GroupDirection.FORWARD) {
                            travelDistance
                        } else {
                            -travelDistance
                        }
                        stageSurface.alpha = 0.9f
                        stageSurface.animate()
                            .rotationY(0f)
                            .translationX(0f)
                            .alpha(1f)
                            .setDuration(180L)
                            .setListener(
                                object : AnimatorListenerAdapter() {
                                    override fun onAnimationEnd(animation: Animator) {
                                        stageSurface.animate().setListener(null)
                                        isTransitionRunning = false
                                        removePauseReason(PauseReason.TRANSITION)
                                    }
                                },
                            )
                            .start()
                    }
                },
            )
            .start()
    }

    private fun toggleSound() {
        isMuted = !isMuted
        currentPlayer?.volume = if (isMuted) 0f else 1f
        updateSoundButton()
    }

    private fun handleGestureTouch(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                if (isTransitionRunning) {
                    return true
                }
                downX = event.x
                downY = event.y
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
                        if (abs(deltaX) >= groupSwipeThresholdPx()) {
                            if (deltaX < 0f) {
                                navigateToNextGroupBySwipe()
                            } else {
                                navigateToPreviousGroupBySwipe()
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
                }
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
        if (::gestureOverlay.isInitialized) {
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
        if (pauseReasons.isEmpty()) {
            resumeCurrentStory()
        } else {
            pauseCurrentStory()
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

    private fun addMediaBackdrop(imageUrl: String?) {
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
            interpolator = android.view.animation.LinearInterpolator()
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

    private fun updateSoundButton() {
        soundIconView.setImageResource(
            if (isMuted) {
                android.R.drawable.ic_lock_silent_mode
            } else {
                android.R.drawable.ic_lock_silent_mode_off
            },
        )
        soundButton.contentDescription = context.getString(
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
                FrameLayout.LayoutParams(dp(18), dp(18), Gravity.CENTER),
            )
            layoutParams = FrameLayout.LayoutParams(dp(36), dp(36))
            minimumWidth = dp(36)
            minimumHeight = dp(36)
        }
    }

    private fun actionIcon(iconRes: Int): ImageView {
        return ImageView(context).apply {
            setImageResource(iconRes)
            setColorFilter(Color.WHITE)
        }
    }

    private fun circularImageView(sizeDp: Int): ImageView {
        val imageView = ImageView(context).apply {
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

        imageView.layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
        return imageView
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

    private fun swipeDismissThresholdPx(): Float = dp(120).toFloat()

    private fun groupSwipeThresholdPx(): Float = dp(56).toFloat()

    companion object {
        fun show(
            anchorContext: Context,
            response: SdkFeedResponsePayload,
            initialGroupIndex: Int,
            initialStoryIndex: Int,
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
                viewedStorySession = viewedStorySession,
                callbacks = callbacks,
            ).show()
            return true
        }

        private const val DEFAULT_IMAGE_DURATION_MS = 5_000L
        private const val VIDEO_PROGRESS_UPDATE_INTERVAL_MS = 33L
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

package com.openstory.sdk.internal.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.text.TextUtils
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.ColorInt
import androidx.core.view.isVisible
import androidx.core.view.setPadding
import coil.load
import com.openstory.sdk.OpenStoryCallbacks
import com.openstory.sdk.R
import com.openstory.sdk.internal.cache.ViewedStoryStateSnapshot
import com.openstory.sdk.internal.network.SdkFeedGroupPayload
import com.openstory.sdk.internal.network.SdkFeedResponsePayload
import com.openstory.sdk.model.OpenStoryAnalyticsEvent

internal class StoryBarView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {
    private val emptyStateView = TextView(context).apply {
        setTextColor(Color.parseColor("#6D3D18"))
        textSize = 12f
        setPadding(dp(12))
        gravity = Gravity.CENTER_VERTICAL
        background = roundedBackground("#FFE5D0")
        isVisible = false
    }

    private val scrollView = HorizontalScrollView(context).apply {
        isHorizontalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        clipToPadding = false
    }

    private val groupRow = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.TOP
        setPadding(dp(4), dp(4), dp(4), dp(8))
        clipChildren = false
        clipToPadding = false
    }

    private var callbacks: OpenStoryCallbacks = object : OpenStoryCallbacks {}
    private var viewerLauncher: ViewerLauncher? = null
    private var impressionSentForPlacement = false
    private var lastPlacementKey: String? = null
    private var boundPlacementKey: String? = null
    private var isContentVisible = false
    @ColorInt
    private var titleTextColor: Int = DEFAULT_TITLE_TEXT_COLOR
    @ColorInt
    private var viewedTitleTextColor: Int = DEFAULT_VIEWED_TITLE_TEXT_COLOR

    init {
        clipChildren = false
        clipToPadding = false
        scrollView.addView(
            groupRow,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )

        addView(
            emptyStateView,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.WRAP_CONTENT,
            ),
        )
        addView(
            scrollView,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.WRAP_CONTENT,
            ),
        )
    }

    fun bindPlacementKey(placementKey: String) {
        boundPlacementKey = placementKey
    }

    fun showLoading() {
        emptyStateView.isVisible = false
        if (groupRow.childCount == 0) {
            scrollView.isVisible = false
            updateContentVisibility(false)
            return
        }

        scrollView.isVisible = true
        updateContentVisibility(true)
    }

    fun showEmpty(text: CharSequence) {
        @Suppress("UNUSED_PARAMETER")
        val unusedText = text
        groupRow.removeAllViews()
        scrollView.isVisible = false
        emptyStateView.isVisible = false
        updateContentVisibility(false)
    }

    fun updateCallbacks(callbacks: OpenStoryCallbacks) {
        this.callbacks = callbacks
    }

    fun updateViewerLauncher(viewerLauncher: ViewerLauncher) {
        this.viewerLauncher = viewerLauncher
    }

    fun updateTitleColors(
        @ColorInt textColor: Int,
        @ColorInt viewedTextColor: Int,
    ) {
        titleTextColor = textColor
        viewedTitleTextColor = viewedTextColor
    }

    fun dispatchError(placementKey: String, throwable: Throwable) {
        callbacks.onError(placementKey, throwable)
    }

    fun renderSnapshot(
        response: SdkFeedResponsePayload,
        isCached: Boolean,
        viewedState: ViewedStoryStateSnapshot,
    ) {
        if (lastPlacementKey != response.placementKey) {
            impressionSentForPlacement = false
            lastPlacementKey = response.placementKey
        }
        boundPlacementKey = response.placementKey

        val groups = response.resolvedSet?.groups.orEmpty()
        if (groups.isEmpty()) {
            showEmpty(context.getString(R.string.open_story_empty))
            return
        }

        emptyStateView.isVisible = false
        scrollView.isVisible = true
        groupRow.removeAllViews()

        groups.forEachIndexed { index, group ->
            groupRow.addView(
                createGroupAvatar(
                    group = group,
                    isCached = isCached,
                    isViewed = viewedState.isGroupViewed(group),
                ) {
                    callbacks.onStoryGroupTap(
                        OpenStoryAnalyticsEvent(
                            kind = OpenStoryAnalyticsEvent.Kind.STORY_GROUP_TAP,
                            placementKey = response.placementKey,
                            storyGroupId = group.id,
                            storyGroupRevisionId = group.revisionId,
                        ),
                    )

                    val activeViewerLauncher = viewerLauncher
                    if (activeViewerLauncher == null) {
                        callbacks.onError(
                            response.placementKey,
                            IllegalStateException("Story viewer is not available."),
                        )
                        return@createGroupAvatar
                    }

                    activeViewerLauncher.open(
                        anchorContext = context,
                        response = response,
                        initialGroupIndex = index,
                        isCached = isCached,
                        group = group,
                        callbacks = callbacks,
                    )
                },
            )
        }

        updateContentVisibility(true)

        if (!impressionSentForPlacement) {
            callbacks.onStoryBarImpression(
                OpenStoryAnalyticsEvent(
                    kind = OpenStoryAnalyticsEvent.Kind.STORY_BAR_IMPRESSION,
                    placementKey = response.placementKey,
                ),
            )
            impressionSentForPlacement = true
        }
    }

    private fun updateContentVisibility(isVisible: Boolean) {
        if (isContentVisible == isVisible) {
            return
        }

        isContentVisible = isVisible
        val placementKey = boundPlacementKey ?: lastPlacementKey ?: return
        callbacks.onStoryBarVisibilityChanged(placementKey, isVisible)
    }

    private fun createGroupAvatar(
        group: SdkFeedGroupPayload,
        isCached: Boolean,
        isViewed: Boolean,
        onClick: () -> Unit,
    ): View {
        val avatarDiameterPx = dp(AVATAR_DIAMETER_DP)
        val ringStrokeWidthPx = dp(AVATAR_RING_STROKE_WIDTH_DP)
        val imageDiameterPx = dp(AVATAR_IMAGE_DIAMETER_DP)
        val activeTextColor = if (isViewed) viewedTitleTextColor else titleTextColor

        val outer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setOnClickListener { onClick() }
            clipChildren = false
            clipToPadding = false
        }

        val ringHost = FrameLayout(context).apply {
            clipChildren = false
            clipToPadding = false
            minimumWidth = maxOf(dp(74), avatarDiameterPx + dp(10))
        }
        val avatarFrame = FrameLayout(context).apply {
            clipChildren = false
            clipToPadding = false
        }

        val ringColors = storyAvatarRingColors(
            isViewed = isViewed,
            isCached = isCached,
        )

        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = null
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                outlineProvider = object : ViewOutlineProvider() {
                    override fun getOutline(view: View, outline: Outline) {
                        outline.setOval(0, 0, view.width, view.height)
                    }
                }
                clipToOutline = true
            }
            load(group.logoUrl)
        }

        val badgeValue = group.badge?.value?.takeIf { it.isNotBlank() }
        val badge = badgeValue?.let { renderedBadgeValue ->
            val isSvgBadge = group.badge?.type == "svg"
            TextView(context).apply {
                text = if (isSvgBadge) "SVG" else renderedBadgeValue
                minWidth = dp(if (isSvgBadge) 24 else 28)
                minHeight = dp(if (isSvgBadge) 24 else 28)
                textSize = if (isSvgBadge) 11f else 14f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                setTypeface(typeface, Typeface.BOLD)
                background = roundedBackground("#000000")
                setPadding(dp(if (isSvgBadge) 6 else 5), dp(0), dp(if (isSvgBadge) 6 else 5), dp(0))
                elevation = dp(2).toFloat()
            }
        }

        val shouldRenderBottomLabel = badgeValue == null
        val bottomLabel = group.bottomLabel
            ?.takeIf { shouldRenderBottomLabel && it.isNotBlank() }
            ?.let { bottomLabelValue ->
            TextView(context).apply {
                text = bottomLabelValue
                gravity = Gravity.CENTER
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                textSize = 10f
                setTextColor(Color.parseColor(BOTTOM_LABEL_TEXT_HEX))
                setTypeface(typeface, Typeface.BOLD)
                background = roundedBackground(
                    BOTTOM_LABEL_BACKGROUND_HEX,
                    BOTTOM_LABEL_CORNER_RADIUS_DP,
                )
                setPadding(dp(7), dp(2), dp(7), dp(2))
            }
        }

        avatarFrame.addView(
            GradientRingView(
                context = context,
                startColor = ringColors.startColor,
                endColor = ringColors.endColor,
                strokeWidthPx = ringStrokeWidthPx.toFloat(),
            ),
            LayoutParams(
                avatarDiameterPx,
                avatarDiameterPx,
                Gravity.CENTER,
            ),
        )
        avatarFrame.addView(
            image,
            LayoutParams(
                imageDiameterPx,
                imageDiameterPx,
                Gravity.CENTER,
            ),
        )

        if (badge != null) {
            avatarFrame.addView(
                badge,
                LayoutParams(
                    LayoutParams.WRAP_CONTENT,
                    LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM or Gravity.END,
                ).apply {
                    bottomMargin = dp(1)
                    marginEnd = dp(2)
                },
            )
        }

        ringHost.addView(
            avatarFrame,
            LayoutParams(
                avatarDiameterPx,
                avatarDiameterPx,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL,
            ),
        )
        if (bottomLabel != null) {
            ringHost.addView(
                bottomLabel,
                LayoutParams(
                    LayoutParams.WRAP_CONTENT,
                    LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
                ).apply {
                    bottomMargin = dp(8)
                },
            )
        }

        val title = TextView(context).apply {
            text = group.title
            textSize = 11f
            gravity = Gravity.CENTER
            maxLines = 2
            setTextColor(activeTextColor)
        }

        outer.addView(
            ringHost,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                avatarDiameterPx + dp(8),
            ),
        )
        outer.addView(
            title,
            LinearLayout.LayoutParams(dp(74), ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = if (bottomLabel != null) dp(0) else dp(2)
            },
        )

        return outer.apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                if (groupRow.childCount > 0) {
                    marginStart = dp(6)
                }
            }
        }
    }

    private fun roundedBackground(
        hexColor: String,
        cornerRadiusDp: Float = 999f,
    ): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(cornerRadiusDp).toFloat()
            setColor(Color.parseColor(hexColor))
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun dp(value: Float): Int =
        (value * resources.displayMetrics.density).toInt()

    fun interface ViewerLauncher {
        fun open(
            anchorContext: Context,
            response: SdkFeedResponsePayload,
            initialGroupIndex: Int,
            isCached: Boolean,
            group: SdkFeedGroupPayload,
            callbacks: OpenStoryCallbacks,
        )
    }

    private companion object {
        const val AVATAR_DIAMETER_DP = STORY_BAR_AVATAR_RING_DIAMETER_DP
        const val AVATAR_RING_STROKE_WIDTH_DP = STORY_BAR_AVATAR_RING_STROKE_WIDTH_DP
        const val AVATAR_IMAGE_DIAMETER_DP = STORY_BAR_AVATAR_IMAGE_DIAMETER_DP
        const val BOTTOM_LABEL_BACKGROUND_HEX = "#FDD74E"
        const val BOTTOM_LABEL_TEXT_HEX = "#8B7502"
        const val BOTTOM_LABEL_CORNER_RADIUS_DP = 5f

        @ColorInt
        val DEFAULT_TITLE_TEXT_COLOR: Int = Color.parseColor("#2B1A12")

        @ColorInt
        val DEFAULT_VIEWED_TITLE_TEXT_COLOR: Int = Color.parseColor("#8E8176")
    }
}

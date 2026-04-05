package com.openstory.sdk.internal.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
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
    }

    private val scrollView = HorizontalScrollView(context).apply {
        isHorizontalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        clipToPadding = false
    }

    private val groupRow = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(4), dp(4), dp(4), dp(8))
        clipChildren = false
        clipToPadding = false
    }

    private var callbacks: OpenStoryCallbacks = object : OpenStoryCallbacks {}
    private var viewerLauncher: ViewerLauncher? = null
    private var impressionSentForPlacement = false
    private var lastPlacementKey: String? = null

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

    fun showLoading() {
        groupRow.removeAllViews()
        scrollView.isVisible = false
        emptyStateView.isVisible = true
        emptyStateView.setText(R.string.open_story_loading)
    }

    fun showEmpty(text: CharSequence) {
        groupRow.removeAllViews()
        scrollView.isVisible = false
        emptyStateView.isVisible = true
        emptyStateView.text = text
    }

    fun updateCallbacks(callbacks: OpenStoryCallbacks) {
        this.callbacks = callbacks
    }

    fun updateViewerLauncher(viewerLauncher: ViewerLauncher) {
        this.viewerLauncher = viewerLauncher
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
                        group = group,
                        callbacks = callbacks,
                    )
                },
            )
        }

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

    private fun createGroupAvatar(
        group: SdkFeedGroupPayload,
        isCached: Boolean,
        isViewed: Boolean,
        onClick: () -> Unit,
    ): View {
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
        }

        val ring = FrameLayout(context).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                if (isViewed) {
                    intArrayOf(Color.parseColor("#D8CEC2"), Color.parseColor("#BDB2A6"))
                } else if (isCached) {
                    intArrayOf(Color.parseColor("#C3A173"), Color.parseColor("#B4845D"))
                } else {
                    intArrayOf(Color.parseColor("#F59E0B"), Color.parseColor("#8B5CF6"))
                },
            ).apply {
                shape = GradientDrawable.OVAL
            }
            setPadding(dp(1))
        }

        val middle = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#F7E8DA"))
            }
            setPadding(dp(4))
        }

        val inner = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.WHITE)
            }
            setPadding(dp(1))
        }

        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#F7E8DA"))
            }
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

        inner.addView(
            image,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT,
            ),
        )
        middle.addView(
            inner,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT,
            ),
        )

        val badge = group.badge?.value?.takeIf { it.isNotBlank() }?.let { badgeValue ->
            TextView(context).apply {
                text = if (group.badge?.type == "svg") "SVG" else badgeValue
                minWidth = dp(24)
                minHeight = dp(24)
                textSize = 11f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                setTypeface(typeface, Typeface.BOLD)
                background = roundedBackground("#000000")
                setPadding(dp(6), dp(0), dp(6), dp(0))
                elevation = dp(2).toFloat()
            }
        }

        ring.addView(
            middle,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT,
            ),
        )
        ringHost.addView(
            ring,
            LayoutParams(
                dp(64),
                dp(64),
                Gravity.CENTER,
            ),
        )

        if (badge != null) {
            ringHost.addView(
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

        val title = TextView(context).apply {
            text = group.title
            textSize = 12f
            gravity = Gravity.CENTER
            maxLines = 2
            setTextColor(Color.parseColor("#2B1A12"))
        }

        outer.addView(
            ringHost,
            LinearLayout.LayoutParams(dp(74), dp(72)),
        )
        outer.addView(
            title,
            LinearLayout.LayoutParams(dp(92), ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(6)
            },
        )

        return outer.apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                if (groupRow.childCount > 0) {
                    marginStart = dp(14)
                }
            }
        }
    }

    private fun roundedBackground(hexColor: String): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(999).toFloat()
            setColor(Color.parseColor(hexColor))
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    fun interface ViewerLauncher {
        fun open(
            anchorContext: Context,
            response: SdkFeedResponsePayload,
            initialGroupIndex: Int,
            group: SdkFeedGroupPayload,
            callbacks: OpenStoryCallbacks,
        )
    }
}

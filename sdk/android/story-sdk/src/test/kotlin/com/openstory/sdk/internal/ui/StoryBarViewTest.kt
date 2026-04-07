package com.openstory.sdk.internal.ui

import android.graphics.Color
import android.util.TypedValue
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import com.openstory.sdk.internal.cache.ViewedStoryStateSnapshot
import com.openstory.sdk.internal.network.SdkFeedAssetPayload
import com.openstory.sdk.internal.network.SdkFeedBadgePayload
import com.openstory.sdk.internal.network.SdkFeedContextPayload
import com.openstory.sdk.internal.network.SdkFeedGroupPayload
import com.openstory.sdk.internal.network.SdkFeedResponsePayload
import com.openstory.sdk.internal.network.SdkFeedSetPayload
import com.openstory.sdk.internal.network.SdkFeedStoryPayload
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class StoryBarViewTest {
    @Test
    fun avatarRingStrokeWidthIsTwoDpThickerThanBaseline() {
        val field = StoryBarView::class.java.getDeclaredField("AVATAR_RING_STROKE_WIDTH_DP")
        field.isAccessible = true

        assertThat(field.getFloat(null)).isEqualTo(3.53f)
    }

    @Test
    fun bottomLabelStyleMatchesIosTokens() {
        val backgroundField = StoryBarView::class.java.getDeclaredField("BOTTOM_LABEL_BACKGROUND_HEX")
        backgroundField.isAccessible = true
        val radiusField = StoryBarView::class.java.getDeclaredField("BOTTOM_LABEL_CORNER_RADIUS_DP")
        radiusField.isAccessible = true

        assertThat(backgroundField.get(null) as String).isEqualTo("#FDD74E")
        assertThat(radiusField.getFloat(null)).isEqualTo(5f)
    }

    @Test
    fun renderSnapshotUsesConfiguredTextColorForUnviewedGroups() {
        val view = StoryBarView(ApplicationProvider.getApplicationContext())
        val textColor = Color.WHITE
        val viewedTextColor = Color.parseColor("#CFCFCF")
        val group = storyGroup(
            title = "Launches",
            revisions = listOf("story-rev-1", "story-rev-2"),
        )

        view.updateTitleColors(
            textColor = textColor,
            viewedTextColor = viewedTextColor,
        )
        view.renderSnapshot(
            response = responsePayload(group),
            isCached = false,
            viewedState = ViewedStoryStateSnapshot(viewedStoryRevisionIds = setOf("story-rev-1")),
        )

        assertThat(findGroupTitle(view, group.title).currentTextColor).isEqualTo(textColor)
    }

    @Test
    fun renderSnapshotUsesConfiguredViewedTextColorForFullyViewedGroups() {
        val view = StoryBarView(ApplicationProvider.getApplicationContext())
        val textColor = Color.WHITE
        val viewedTextColor = Color.parseColor("#CFCFCF")
        val group = storyGroup(
            title = "Featured",
            revisions = listOf("story-rev-1", "story-rev-2"),
        )

        view.updateTitleColors(
            textColor = textColor,
            viewedTextColor = viewedTextColor,
        )
        view.renderSnapshot(
            response = responsePayload(group),
            isCached = false,
            viewedState = ViewedStoryStateSnapshot(
                viewedStoryRevisionIds = setOf("story-rev-1", "story-rev-2"),
            ),
        )

        assertThat(findGroupTitle(view, group.title).currentTextColor).isEqualTo(viewedTextColor)
    }

    @Test
    fun renderSnapshotUsesIosBottomLabelTextColor() {
        val view = StoryBarView(ApplicationProvider.getApplicationContext())
        val group = storyGroup(
            title = "Featured",
            bottomLabel = "NEW",
            revisions = listOf("story-rev-1"),
        )

        view.updateTitleColors(
            textColor = Color.parseColor("#F3E7D8"),
            viewedTextColor = Color.parseColor("#CFCFCF"),
        )
        view.renderSnapshot(
            response = responsePayload(group),
            isCached = false,
            viewedState = ViewedStoryStateSnapshot(viewedStoryRevisionIds = emptySet()),
        )

        assertThat(findTextView(view, "NEW").currentTextColor).isEqualTo(Color.parseColor("#8B7502"))
    }

    @Test
    fun renderSnapshotPrefersBadgeOverBottomLabelWhenBothExist() {
        val view = StoryBarView(ApplicationProvider.getApplicationContext())
        val group = storyGroup(
            title = "Featured",
            bottomLabel = "NEW",
            badge = SdkFeedBadgePayload(type = "emoji", value = "🔥"),
            revisions = listOf("story-rev-1"),
        )

        view.renderSnapshot(
            response = responsePayload(group),
            isCached = false,
            viewedState = ViewedStoryStateSnapshot(viewedStoryRevisionIds = emptySet()),
        )

        assertThat(findTextViewOrNull(view, "NEW")).isNull()
        assertThat(findTextView(view, "🔥").text.toString()).isEqualTo("🔥")
    }

    @Test
    fun renderSnapshotUsesLargerTextSizeForEmojiBadge() {
        val view = StoryBarView(ApplicationProvider.getApplicationContext())
        val group = storyGroup(
            title = "Featured",
            badge = SdkFeedBadgePayload(type = "emoji", value = "🔥"),
            revisions = listOf("story-rev-1"),
        )

        view.renderSnapshot(
            response = responsePayload(group),
            isCached = false,
            viewedState = ViewedStoryStateSnapshot(viewedStoryRevisionIds = emptySet()),
        )

        val expectedTextSizePx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_SP,
            14f,
            view.resources.displayMetrics,
        )
        assertThat(findTextView(view, "🔥").textSize).isWithin(0.01f).of(expectedTextSizePx)
    }

    private fun responsePayload(group: SdkFeedGroupPayload): SdkFeedResponsePayload {
        return SdkFeedResponsePayload(
            clientId = "client-1",
            placementKey = "home_top_story_bar",
            context = SdkFeedContextPayload(
                platform = "android",
                appVersion = "1.0.0",
                userSegments = emptyList(),
            ),
            resolvedSet = SdkFeedSetPayload(
                id = "set-1",
                revisionId = "set-rev-1",
                placementKey = "home_top_story_bar",
                isFallback = false,
                groups = listOf(group),
            ),
            generatedAt = "2026-04-05T00:00:00Z",
        )
    }

    private fun storyGroup(
        title: String,
        bottomLabel: String? = null,
        badge: SdkFeedBadgePayload? = null,
        revisions: List<String>,
    ): SdkFeedGroupPayload {
        return SdkFeedGroupPayload(
            id = "group-1",
            revisionId = "group-rev-1",
            title = title,
            bottomLabel = bottomLabel,
            logoUrl = "https://example.com/logo.jpg",
            badge = badge,
            stories = revisions.mapIndexed { index, revisionId ->
                SdkFeedStoryPayload(
                    id = "story-${index + 1}",
                    revisionId = revisionId,
                    title = "Story ${index + 1}",
                    mediaType = "image",
                    imageDurationMs = 5_000,
                    asset = SdkFeedAssetPayload(
                        id = "asset-${index + 1}",
                        url = "https://example.com/story-${index + 1}.jpg",
                        mimeType = "image/jpeg",
                    ),
                    posterAsset = null,
                    cta = null,
                )
            },
        )
    }

    private fun findGroupTitle(
        view: StoryBarView,
        expectedTitle: String,
    ): TextView {
        val outer = view.getChildAt(1) as android.widget.HorizontalScrollView
        val groupRow = outer.getChildAt(0) as LinearLayout
        val avatar = groupRow.getChildAt(0) as LinearLayout
        val titleView = avatar.getChildAt(1) as TextView
        assertThat(titleView.text.toString()).isEqualTo(expectedTitle)
        return titleView
    }

    private fun findTextView(
        root: View,
        expectedText: String,
    ): TextView {
        return findTextViewOrNull(root, expectedText)
            ?: throw AssertionError("TextView not found for text=$expectedText")
    }

    private fun findTextViewOrNull(
        root: View,
        expectedText: String,
    ): TextView? {
        if (root is TextView && root.text.toString() == expectedText) {
            return root
        }

        if (root is android.view.ViewGroup) {
            for (index in 0 until root.childCount) {
                val candidate = findTextViewOrNull(root.getChildAt(index), expectedText)
                if (candidate != null) {
                    return candidate
                }
            }
        }

        return null
    }
}

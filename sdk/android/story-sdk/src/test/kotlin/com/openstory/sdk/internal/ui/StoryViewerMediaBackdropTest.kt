package com.openstory.sdk.internal.ui

import com.google.common.truth.Truth.assertThat
import com.openstory.sdk.internal.network.SdkFeedAssetPayload
import com.openstory.sdk.internal.network.SdkFeedStoryPayload
import org.junit.Test

class StoryViewerMediaBackdropTest {
    @Test
    fun imageStoriesDoNotProvideBackdropImage() {
        val story = story(
            mediaType = "image",
            assetUrl = "https://cdn.example.com/story.jpg",
            posterUrl = "https://cdn.example.com/poster.jpg",
        )

        assertThat(story.viewerBackdropImageUrl).isNull()
    }

    @Test
    fun videoStoriesPreferPosterForBackdrop() {
        val story = story(
            mediaType = "video",
            assetUrl = "https://cdn.example.com/story.mp4",
            posterUrl = "https://cdn.example.com/poster.jpg",
        )

        assertThat(story.viewerBackdropImageUrl)
            .isEqualTo("https://cdn.example.com/poster.jpg")
    }

    @Test
    fun videoStoriesFallbackToPrimaryAssetWhenPosterMissing() {
        val story = story(
            mediaType = "video",
            assetUrl = "https://cdn.example.com/story.mp4",
            posterUrl = null,
        )

        assertThat(story.viewerBackdropImageUrl)
            .isEqualTo("https://cdn.example.com/story.mp4")
    }

    private fun story(
        mediaType: String,
        assetUrl: String,
        posterUrl: String?,
    ): SdkFeedStoryPayload = SdkFeedStoryPayload(
        id = "story-1",
        revisionId = "story-rev-1",
        title = "Story",
        mediaType = mediaType,
        imageDurationMs = 5_000,
        asset = SdkFeedAssetPayload(
            id = "asset-1",
            url = assetUrl,
            mimeType = if (mediaType == "video") {
                "video/mp4"
            } else {
                "image/jpeg"
            },
        ),
        posterAsset = posterUrl?.let {
            SdkFeedAssetPayload(
                id = "poster-1",
                url = it,
                mimeType = "image/jpeg",
            )
        },
        cta = null,
    )
}

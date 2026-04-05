package com.openstory.sdk.internal.network

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SdkFeedResponseNormalizerTest {
    @Test
    fun normalizeLoopbackUrlsRewritesAssetHostsToBaseUrlHost() {
        val response = SdkFeedResponsePayload(
            clientId = "public-client-id",
            placementKey = "home_top_story_bar",
            context = SdkFeedContextPayload(
                platform = "android",
                appVersion = "1.0.0",
                userSegments = listOf("premium"),
            ),
            resolvedSet = SdkFeedSetPayload(
                id = "set-1",
                revisionId = "set-rev-1",
                placementKey = "home_top_story_bar",
                isFallback = false,
                groups = listOf(
                    SdkFeedGroupPayload(
                        id = "group-1",
                        revisionId = "group-rev-1",
                        title = "Launches",
                        logoUrl = "http://localhost:3001/uploads/logo.jpg",
                        badge = null,
                        stories = listOf(
                            SdkFeedStoryPayload(
                                id = "story-1",
                                revisionId = "story-rev-1",
                                title = "Hero",
                                mediaType = "image",
                                imageDurationMs = 5000,
                                asset = SdkFeedAssetPayload(
                                    id = "asset-1",
                                    url = "http://127.0.0.1:3001/uploads/story.jpg",
                                    mimeType = "image/jpeg",
                                ),
                                posterAsset = null,
                                cta = null,
                            ),
                        ),
                    ),
                ),
            ),
            generatedAt = "2026-04-05T00:00:00.000Z",
        )

        val normalized = SdkFeedResponseNormalizer.normalizeLoopbackUrls(
            response = response,
            baseUrl = "http://10.0.2.2:3001",
        )

        assertThat(normalized.resolvedSet?.groups?.first()?.logoUrl)
            .isEqualTo("http://10.0.2.2:3001/uploads/logo.jpg")
        assertThat(normalized.resolvedSet?.groups?.first()?.stories?.first()?.asset?.url)
            .isEqualTo("http://10.0.2.2:3001/uploads/story.jpg")
    }
}

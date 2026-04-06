@testable import OpenStorySDK

import Testing

@Test
func normalizeLoopbackURLsRewritesAssetHostsToBaseURLHost() {
    let response = SdkFeedResponsePayload(
        clientId: "public-client-id",
        placementKey: "home_top_story_bar",
        context: SdkFeedContextPayload(
            platform: "ios",
            appVersion: "1.0.0",
            userSegments: ["premium"]
        ),
        resolvedSet: SdkFeedSetPayload(
            id: "set-1",
            revisionId: "set-rev-1",
            placementKey: "home_top_story_bar",
            isFallback: false,
            groups: [
                SdkFeedGroupPayload(
                    id: "group-1",
                    revisionId: "group-rev-1",
                    title: "Launches",
                    bottomLabel: "Featured",
                    logoURL: "http://localhost:3001/uploads/logo.jpg",
                    badge: nil,
                    stories: [
                        SdkFeedStoryPayload(
                            id: "story-1",
                            revisionId: "story-rev-1",
                            title: "Hero",
                            mediaType: "image",
                            imageDurationMs: 5_000,
                            asset: SdkFeedAssetPayload(
                                id: "asset-1",
                                url: "http://127.0.0.1:3001/uploads/story.jpg",
                                mimeType: "image/jpeg",
                                width: nil,
                                height: nil,
                                durationMs: nil
                            ),
                            posterAsset: nil,
                            cta: nil
                        ),
                    ]
                ),
            ]
        ),
        generatedAt: "2026-04-05T00:00:00.000Z"
    )

    let normalized = SdkFeedResponseNormalizer.normalizeLoopbackURLs(
        response: response,
        baseURL: "http://10.0.2.2:3001"
    )

    #expect(normalized.resolvedSet?.groups.first?.logoURL == "http://10.0.2.2:3001/uploads/logo.jpg")
    #expect(normalized.resolvedSet?.groups.first?.stories.first?.asset.url == "http://10.0.2.2:3001/uploads/story.jpg")
}

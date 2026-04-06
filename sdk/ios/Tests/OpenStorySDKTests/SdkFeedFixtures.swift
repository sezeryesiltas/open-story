@testable import OpenStorySDK

import Foundation

func makeStoryGroup(
    title: String = "Launches",
    bottomLabel: String? = nil,
    badge: SdkFeedBadgePayload? = nil,
    revisions: [String]
) -> SdkFeedGroupPayload {
    SdkFeedGroupPayload(
        id: "group-1",
        revisionId: "group-rev-1",
        title: title,
        bottomLabel: bottomLabel,
        logoURL: "https://example.com/logo.jpg",
        badge: badge,
        stories: revisions.enumerated().map { index, revisionId in
            SdkFeedStoryPayload(
                id: "story-\(index + 1)",
                revisionId: revisionId,
                title: "Story \(index + 1)",
                mediaType: "image",
                imageDurationMs: 5_000,
                asset: SdkFeedAssetPayload(
                    id: "asset-\(index + 1)",
                    url: "https://example.com/story-\(index + 1).jpg",
                    mimeType: "image/jpeg",
                    width: nil,
                    height: nil,
                    durationMs: nil
                ),
                posterAsset: nil,
                cta: nil
            )
        }
    )
}

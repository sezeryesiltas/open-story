@testable import OpenStorySDK

import Testing

@Test
func imageStoriesDoNotRenderBackdropImage() {
    let story = makeStory(mediaType: "image")

    #expect(story.viewerBackdropImageURL == nil)
}

@Test
func videoStoriesPreferPosterForBackdropImage() {
    let story = makeStory(
        mediaType: "video",
        assetURL: "https://example.com/story.mp4",
        posterURL: "https://example.com/poster.jpg"
    )

    #expect(story.viewerBackdropImageURL == "https://example.com/poster.jpg")
}

@Test
func videoStoriesFallbackToPrimaryAssetWhenPosterIsMissing() {
    let story = makeStory(
        mediaType: "video",
        assetURL: "https://example.com/story.mp4",
        posterURL: nil
    )

    #expect(story.viewerBackdropImageURL == "https://example.com/story.mp4")
}

private func makeStory(
    mediaType: String,
    assetURL: String = "https://example.com/story.jpg",
    posterURL: String? = nil
) -> SdkFeedStoryPayload {
    SdkFeedStoryPayload(
        id: "story-1",
        revisionId: "story-rev-1",
        title: "Story 1",
        mediaType: mediaType,
        imageDurationMs: 5_000,
        asset: SdkFeedAssetPayload(
            id: "asset-1",
            url: assetURL,
            mimeType: mediaType == "video" ? "video/mp4" : "image/jpeg",
            width: nil,
            height: nil,
            durationMs: mediaType == "video" ? 10_000 : nil
        ),
        posterAsset: posterURL.map {
            SdkFeedAssetPayload(
                id: "poster-1",
                url: $0,
                mimeType: "image/jpeg",
                width: nil,
                height: nil,
                durationMs: nil
            )
        },
        cta: nil
    )
}

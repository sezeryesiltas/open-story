@testable import OpenStorySDK

import Testing

@Test
func createProducesStableKeyForEquivalentSegmentSets() {
    let first = StoryFeedCacheKey.create(
        placementKey: "home_top_story_bar",
        platform: "ios",
        appVersion: "5.2.0",
        userSegments: ["vip", "beta"]
    )
    let second = StoryFeedCacheKey.create(
        placementKey: "home_top_story_bar",
        platform: "ios",
        appVersion: "5.2.0",
        userSegments: ["beta", "vip", "vip"]
    )

    #expect(first.databaseKey == second.databaseKey)
    #expect(first.normalizedUserSegments == ["beta", "vip"])
}

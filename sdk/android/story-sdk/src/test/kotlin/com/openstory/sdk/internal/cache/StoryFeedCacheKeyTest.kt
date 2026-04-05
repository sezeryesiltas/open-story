package com.openstory.sdk.internal.cache

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class StoryFeedCacheKeyTest {
    @Test
    fun createProducesStableKeyForEquivalentSegmentSets() {
        val first = StoryFeedCacheKey.create(
            placementKey = "home_top_story_bar",
            platform = "android",
            appVersion = "8.1.0",
            userSegments = listOf("vip", "beta"),
        )
        val second = StoryFeedCacheKey.create(
            placementKey = "home_top_story_bar",
            platform = "android",
            appVersion = "8.1.0",
            userSegments = listOf("beta", "vip", "vip"),
        )

        assertThat(first.databaseKey).isEqualTo(second.databaseKey)
        assertThat(first.normalizedUserSegments).containsExactly("beta", "vip").inOrder()
    }
}

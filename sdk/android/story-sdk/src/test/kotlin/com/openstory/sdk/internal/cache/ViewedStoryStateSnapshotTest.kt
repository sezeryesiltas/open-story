package com.openstory.sdk.internal.cache

import com.google.common.truth.Truth.assertThat
import com.openstory.sdk.internal.network.SdkFeedAssetPayload
import com.openstory.sdk.internal.network.SdkFeedGroupPayload
import com.openstory.sdk.internal.network.SdkFeedStoryPayload
import org.junit.Test

class ViewedStoryStateSnapshotTest {
    @Test
    fun firstUnviewedStoryIndexReturnsFirstUnviewedStory() {
        val group = storyGroup(
            revisions = listOf("story-rev-1", "story-rev-2", "story-rev-3"),
        )

        val snapshot = ViewedStoryStateSnapshot(
            viewedStoryRevisionIds = setOf("story-rev-1"),
        )

        assertThat(snapshot.firstUnviewedStoryIndex(group)).isEqualTo(1)
        assertThat(snapshot.isGroupViewed(group)).isFalse()
    }

    @Test
    fun firstUnviewedStoryIndexFallsBackToFirstStoryWhenGroupIsFullyViewed() {
        val group = storyGroup(
            revisions = listOf("story-rev-1", "story-rev-2"),
        )

        val snapshot = ViewedStoryStateSnapshot(
            viewedStoryRevisionIds = setOf("story-rev-1", "story-rev-2"),
        )

        assertThat(snapshot.firstUnviewedStoryIndex(group)).isEqualTo(0)
        assertThat(snapshot.isGroupViewed(group)).isTrue()
    }

    @Test
    fun viewedStorySessionPromotesGroupToViewedAfterLastStoryStarts() {
        val group = storyGroup(
            revisions = listOf("story-rev-1", "story-rev-2"),
        )
        val markedRevisionIds = mutableListOf<String>()
        val session = ViewedStorySession(
            initialSnapshot = ViewedStoryStateSnapshot(
                viewedStoryRevisionIds = setOf("story-rev-1"),
            ),
            onStoryViewed = { storyRevisionId ->
                markedRevisionIds += storyRevisionId
            },
        )

        assertThat(session.firstUnviewedStoryIndex(group)).isEqualTo(1)
        assertThat(session.isGroupViewed(group)).isFalse()

        session.markStoryViewed("story-rev-2")

        assertThat(markedRevisionIds).containsExactly("story-rev-2")
        assertThat(session.firstUnviewedStoryIndex(group)).isEqualTo(0)
        assertThat(session.isGroupViewed(group)).isTrue()
    }

    private fun storyGroup(revisions: List<String>): SdkFeedGroupPayload {
        return SdkFeedGroupPayload(
            id = "group-1",
            revisionId = "group-rev-1",
            title = "Launches",
            logoUrl = "https://example.com/logo.jpg",
            badge = null,
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
}

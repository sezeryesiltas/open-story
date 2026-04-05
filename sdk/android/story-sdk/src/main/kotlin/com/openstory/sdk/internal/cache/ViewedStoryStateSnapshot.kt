package com.openstory.sdk.internal.cache

import com.openstory.sdk.internal.network.SdkFeedGroupPayload
import com.openstory.sdk.internal.network.SdkFeedStoryPayload

internal data class ViewedStoryStateSnapshot(
    val viewedStoryRevisionIds: Set<String>,
) {
    fun isStoryViewed(story: SdkFeedStoryPayload): Boolean {
        return viewedStoryRevisionIds.contains(story.revisionId)
    }

    fun isGroupViewed(group: SdkFeedGroupPayload): Boolean {
        return group.stories.isNotEmpty() && group.stories.all(::isStoryViewed)
    }

    fun firstUnviewedStoryIndex(group: SdkFeedGroupPayload): Int {
        val firstUnviewedIndex = group.stories.indexOfFirst { story -> !isStoryViewed(story) }
        return if (firstUnviewedIndex >= 0) {
            firstUnviewedIndex
        } else {
            0
        }
    }

    fun withViewedStory(storyRevisionId: String): ViewedStoryStateSnapshot {
        if (storyRevisionId.isBlank() || viewedStoryRevisionIds.contains(storyRevisionId)) {
            return this
        }

        return copy(viewedStoryRevisionIds = viewedStoryRevisionIds + storyRevisionId)
    }

    companion object {
        val EMPTY = ViewedStoryStateSnapshot(emptySet())
    }
}

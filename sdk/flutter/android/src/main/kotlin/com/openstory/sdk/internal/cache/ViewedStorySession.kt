package com.openstory.sdk.internal.cache

import com.openstory.sdk.internal.network.SdkFeedGroupPayload

internal class ViewedStorySession(
    initialSnapshot: ViewedStoryStateSnapshot,
    private val onStoryViewed: (String) -> Unit,
) {
    private var snapshot = initialSnapshot

    fun isGroupViewed(group: SdkFeedGroupPayload): Boolean {
        return snapshot.isGroupViewed(group)
    }

    fun firstUnviewedStoryIndex(group: SdkFeedGroupPayload): Int {
        return snapshot.firstUnviewedStoryIndex(group)
    }

    fun markStoryViewed(storyRevisionId: String) {
        val nextSnapshot = snapshot.withViewedStory(storyRevisionId)
        if (nextSnapshot == snapshot) {
            return
        }

        snapshot = nextSnapshot
        onStoryViewed(storyRevisionId)
    }
}

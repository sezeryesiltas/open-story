package com.openstory.sdk.internal.cache

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal class ViewedStoryStateRepository(
    private val dao: ViewedStoryRevisionDao,
) {
    private val mutex = Mutex()

    @Volatile
    private var isLoaded = false

    @Volatile
    private var cachedSnapshot = ViewedStoryStateSnapshot.EMPTY

    suspend fun snapshot(): ViewedStoryStateSnapshot {
        ensureLoaded()
        return cachedSnapshot
    }

    fun currentSnapshot(): ViewedStoryStateSnapshot {
        return cachedSnapshot
    }

    suspend fun markViewed(storyRevisionId: String): Boolean {
        if (storyRevisionId.isBlank()) {
            return false
        }

        ensureLoaded()

        val inserted = mutex.withLock {
            if (cachedSnapshot.viewedStoryRevisionIds.contains(storyRevisionId)) {
                false
            } else {
                cachedSnapshot = cachedSnapshot.withViewedStory(storyRevisionId)
                true
            }
        }

        if (inserted) {
            dao.upsert(
                ViewedStoryRevisionEntity(
                    storyRevisionId = storyRevisionId,
                    firstViewedAtEpochMs = System.currentTimeMillis(),
                ),
            )
        }

        return inserted
    }

    private suspend fun ensureLoaded() {
        if (isLoaded) {
            return
        }

        mutex.withLock {
            if (isLoaded) {
                return
            }

            cachedSnapshot = ViewedStoryStateSnapshot(
                viewedStoryRevisionIds = dao.allViewedStoryRevisionIds().toSet(),
            )
            isLoaded = true
        }
    }
}

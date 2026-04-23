package com.openstory.sdk.internal.cache

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert

@Dao
internal interface StoryFeedSnapshotDao {
    @Query("SELECT * FROM story_feed_snapshots WHERE cache_key = :cacheKey LIMIT 1")
    suspend fun find(cacheKey: String): StoryFeedSnapshotEntity?

    @Upsert
    suspend fun upsert(entity: StoryFeedSnapshotEntity)

    @Query("DELETE FROM story_feed_snapshots WHERE cache_key = :cacheKey")
    suspend fun delete(cacheKey: String)
}

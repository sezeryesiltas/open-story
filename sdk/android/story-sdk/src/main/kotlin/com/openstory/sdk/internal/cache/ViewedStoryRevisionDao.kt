package com.openstory.sdk.internal.cache

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert

@Dao
internal interface ViewedStoryRevisionDao {
    @Query("SELECT story_revision_id FROM viewed_story_revisions")
    suspend fun allViewedStoryRevisionIds(): List<String>

    @Upsert
    suspend fun upsert(entity: ViewedStoryRevisionEntity)
}

package com.openstory.sdk.internal.cache

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "viewed_story_revisions")
internal data class ViewedStoryRevisionEntity(
    @PrimaryKey
    @ColumnInfo(name = "story_revision_id")
    val storyRevisionId: String,
    @ColumnInfo(name = "first_viewed_at_epoch_ms")
    val firstViewedAtEpochMs: Long,
)

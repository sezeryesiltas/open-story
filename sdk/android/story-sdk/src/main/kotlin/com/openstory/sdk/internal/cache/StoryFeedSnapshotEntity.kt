package com.openstory.sdk.internal.cache

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "story_feed_snapshots",
    indices = [
        Index(
            value = ["placement_key", "platform", "app_version", "user_segments_hash"],
            unique = true,
        ),
    ],
)
internal data class StoryFeedSnapshotEntity(
    @PrimaryKey
    @ColumnInfo(name = "cache_key")
    val cacheKey: String,
    @ColumnInfo(name = "placement_key")
    val placementKey: String,
    @ColumnInfo(name = "platform")
    val platform: String,
    @ColumnInfo(name = "app_version")
    val appVersion: String,
    @ColumnInfo(name = "user_segments_hash")
    val userSegmentsHash: String,
    @ColumnInfo(name = "payload_json")
    val payloadJson: String,
    @ColumnInfo(name = "updated_at_epoch_ms")
    val updatedAtEpochMs: Long,
)

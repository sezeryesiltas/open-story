package com.openstory.sdk.internal.cache

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        StoryFeedSnapshotEntity::class,
        ViewedStoryRevisionEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
internal abstract class OpenStoryDatabase : RoomDatabase() {
    abstract fun storyFeedSnapshotDao(): StoryFeedSnapshotDao

    abstract fun viewedStoryRevisionDao(): ViewedStoryRevisionDao
}

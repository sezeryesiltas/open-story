package com.openstory.sdk.model

data class OpenStoryAnalyticsEvent(
    val kind: Kind,
    val placementKey: String,
    val storyGroupId: String? = null,
    val storyGroupRevisionId: String? = null,
    val storyId: String? = null,
    val storyRevisionId: String? = null,
    val occurredAtMillis: Long = System.currentTimeMillis(),
) {
    enum class Kind {
        STORY_BAR_IMPRESSION,
        STORY_GROUP_TAP,
        STORY_VIEW,
        STORY_COMPLETE,
        STORY_CTA_TAP,
        VIEWER_CLOSE,
        GROUP_COMPLETE,
    }
}

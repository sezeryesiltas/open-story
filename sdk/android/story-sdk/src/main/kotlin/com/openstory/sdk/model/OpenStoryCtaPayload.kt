package com.openstory.sdk.model

data class OpenStoryCtaPayload(
    val placementKey: String,
    val storyGroupId: String,
    val storyGroupRevisionId: String,
    val storyId: String,
    val storyRevisionId: String,
    val label: String,
    val targetType: TargetType,
    val targetValue: String,
) {
    enum class TargetType {
        URL,
        DEEPLINK,
    }
}

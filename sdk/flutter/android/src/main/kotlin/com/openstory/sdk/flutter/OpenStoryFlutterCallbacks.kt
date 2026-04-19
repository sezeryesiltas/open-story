package com.openstory.sdk.flutter

import com.openstory.sdk.OpenStoryCallbacks
import com.openstory.sdk.model.OpenStoryAnalyticsEvent
import com.openstory.sdk.model.OpenStoryCtaPayload

internal class OpenStoryFlutterCallbacks(
    private val eventStreamHandler: BufferedEventStreamHandler,
) : OpenStoryCallbacks {
    override fun onStoryBarImpression(event: OpenStoryAnalyticsEvent) {
        eventStreamHandler.send(event.toFlutterPayload())
    }

    override fun onStoryGroupTap(event: OpenStoryAnalyticsEvent) {
        eventStreamHandler.send(event.toFlutterPayload())
    }

    override fun onStoryView(event: OpenStoryAnalyticsEvent) {
        eventStreamHandler.send(event.toFlutterPayload())
    }

    override fun onStoryComplete(event: OpenStoryAnalyticsEvent) {
        eventStreamHandler.send(event.toFlutterPayload())
    }

    override fun onStoryCtaTap(payload: OpenStoryCtaPayload) {
        eventStreamHandler.send(payload.toFlutterPayload())
    }

    override fun onViewerClose(event: OpenStoryAnalyticsEvent) {
        eventStreamHandler.send(event.toFlutterPayload())
    }

    override fun onGroupComplete(event: OpenStoryAnalyticsEvent) {
        eventStreamHandler.send(event.toFlutterPayload())
    }

    override fun onError(
        placementKey: String,
        throwable: Throwable,
    ) {
        eventStreamHandler.send(
            mapOf(
                "type" to "error",
                "placementKey" to placementKey,
                "message" to (
                    throwable.message
                        ?: throwable::class.java.simpleName
                        ?: "Unknown OpenStory error."
                    ),
                "errorType" to throwable::class.java.name,
            ),
        )
    }
}

private fun OpenStoryAnalyticsEvent.toFlutterPayload(): Map<String, Any?> {
    return mapOf(
        "type" to "analytics",
        "kind" to kind.toWireValue(),
        "placementKey" to placementKey,
        "storyGroupId" to storyGroupId,
        "storyGroupRevisionId" to storyGroupRevisionId,
        "storyId" to storyId,
        "storyRevisionId" to storyRevisionId,
        "occurredAtMillis" to occurredAtMillis,
    )
}

private fun OpenStoryAnalyticsEvent.Kind.toWireValue(): String {
    return when (this) {
        OpenStoryAnalyticsEvent.Kind.STORY_BAR_IMPRESSION -> "story_bar_impression"
        OpenStoryAnalyticsEvent.Kind.STORY_GROUP_TAP -> "story_group_tap"
        OpenStoryAnalyticsEvent.Kind.STORY_VIEW -> "story_view"
        OpenStoryAnalyticsEvent.Kind.STORY_COMPLETE -> "story_complete"
        OpenStoryAnalyticsEvent.Kind.STORY_CTA_TAP -> "story_cta_tap"
        OpenStoryAnalyticsEvent.Kind.VIEWER_CLOSE -> "viewer_close"
        OpenStoryAnalyticsEvent.Kind.GROUP_COMPLETE -> "group_complete"
    }
}

private fun OpenStoryCtaPayload.toFlutterPayload(): Map<String, Any?> {
    return mapOf(
        "type" to "cta",
        "placementKey" to placementKey,
        "storyGroupId" to storyGroupId,
        "storyGroupRevisionId" to storyGroupRevisionId,
        "storyId" to storyId,
        "storyRevisionId" to storyRevisionId,
        "label" to label,
        "targetType" to targetType.toWireValue(),
        "targetValue" to targetValue,
    )
}

private fun OpenStoryCtaPayload.TargetType.toWireValue(): String {
    return when (this) {
        OpenStoryCtaPayload.TargetType.URL -> "url"
        OpenStoryCtaPayload.TargetType.DEEPLINK -> "deeplink"
    }
}

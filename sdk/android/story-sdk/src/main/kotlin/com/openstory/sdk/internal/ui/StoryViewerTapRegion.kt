package com.openstory.sdk.internal.ui

internal enum class StoryViewerTapDirection {
    BACKWARD,
    FORWARD,
}

internal fun storyViewerTapDirection(
    tapX: Float,
    width: Int,
): StoryViewerTapDirection {
    return if (tapX < width * STORY_VIEWER_BACKWARD_TAP_WIDTH_RATIO) {
        StoryViewerTapDirection.BACKWARD
    } else {
        StoryViewerTapDirection.FORWARD
    }
}

private const val STORY_VIEWER_BACKWARD_TAP_WIDTH_RATIO = 0.25f

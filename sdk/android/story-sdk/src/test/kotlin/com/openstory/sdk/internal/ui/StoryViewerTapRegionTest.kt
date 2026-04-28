package com.openstory.sdk.internal.ui

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class StoryViewerTapRegionTest {
    @Test
    fun tapsInsideFirstQuarterNavigateBackward() {
        assertThat(storyViewerTapDirection(tapX = 249f, width = 1_000))
            .isEqualTo(StoryViewerTapDirection.BACKWARD)
    }

    @Test
    fun tapsAtFirstQuarterBoundaryNavigateForward() {
        assertThat(storyViewerTapDirection(tapX = 250f, width = 1_000))
            .isEqualTo(StoryViewerTapDirection.FORWARD)
    }

    @Test
    fun tapsAfterFirstQuarterNavigateForward() {
        assertThat(storyViewerTapDirection(tapX = 999f, width = 1_000))
            .isEqualTo(StoryViewerTapDirection.FORWARD)
    }
}

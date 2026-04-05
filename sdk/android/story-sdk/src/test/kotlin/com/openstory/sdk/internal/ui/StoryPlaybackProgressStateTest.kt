package com.openstory.sdk.internal.ui

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class StoryPlaybackProgressStateTest {
    @Test
    fun startedBeginsAtZeroProgress() {
        val state = StoryPlaybackProgressState.started(5_000)

        assertThat(state.totalDurationMs).isEqualTo(5_000)
        assertThat(state.remainingDurationMs).isEqualTo(5_000)
        assertThat(state.fractionCompleted()).isEqualTo(0f)
    }

    @Test
    fun afterElapsedClampsRemainingDurationAndProgressFraction() {
        val state = StoryPlaybackProgressState.started(5_000)
            .afterElapsed(1_250)

        assertThat(state.remainingDurationMs).isEqualTo(3_750)
        assertThat(state.fractionCompleted()).isWithin(0.0001f).of(0.25f)
        assertThat(state.afterElapsed(9_999).remainingDurationMs).isEqualTo(0L)
        assertThat(state.afterElapsed(9_999).fractionCompleted()).isEqualTo(1f)
    }
}

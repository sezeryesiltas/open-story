@testable import OpenStorySDK

import Testing

@Test
func startedBeginsAtZeroProgress() {
    let state = StoryPlaybackProgressState.started(5_000)

    #expect(state.totalDurationMs == 5_000)
    #expect(state.remainingDurationMs == 5_000)
    #expect(abs(state.fractionCompleted() - 0) < 0.0001)
}

@Test
func afterElapsedClampsRemainingDurationAndProgressFraction() {
    let state = StoryPlaybackProgressState.started(5_000)
        .afterElapsed(1_250)

    #expect(state.remainingDurationMs == 3_750)
    #expect(abs(state.fractionCompleted() - 0.25) < 0.0001)
    #expect(state.afterElapsed(9_999).remainingDurationMs == 0)
    #expect(abs(state.afterElapsed(9_999).fractionCompleted() - 1) < 0.0001)
}

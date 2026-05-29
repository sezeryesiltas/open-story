import Foundation

internal struct StoryPlaybackProgressState: Equatable {
    let totalDurationMs: Int64
    let remainingDurationMs: Int64

    func fractionCompleted() -> CGFloat {
        let elapsed = max(0, min(totalDurationMs, totalDurationMs - remainingDurationMs))
        guard totalDurationMs > 0 else {
            return 1
        }
        return CGFloat(Double(elapsed) / Double(totalDurationMs))
    }

    func afterElapsed(_ elapsedDurationMs: Int64) -> StoryPlaybackProgressState {
        StoryPlaybackProgressState(
            totalDurationMs: totalDurationMs,
            remainingDurationMs: max(0, min(totalDurationMs, remainingDurationMs - elapsedDurationMs))
        )
    }

    static func started(_ totalDurationMs: Int64) -> StoryPlaybackProgressState {
        let normalizedDurationMs = max(1, totalDurationMs)
        return StoryPlaybackProgressState(
            totalDurationMs: normalizedDurationMs,
            remainingDurationMs: normalizedDurationMs
        )
    }
}

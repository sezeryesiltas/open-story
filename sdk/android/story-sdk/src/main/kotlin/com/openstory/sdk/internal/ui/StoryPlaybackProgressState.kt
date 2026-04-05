package com.openstory.sdk.internal.ui

internal data class StoryPlaybackProgressState(
    val totalDurationMs: Long,
    val remainingDurationMs: Long,
) {
    fun fractionCompleted(): Float {
        val elapsedDurationMs = (totalDurationMs - remainingDurationMs).coerceIn(0L, totalDurationMs)
        return (elapsedDurationMs.toFloat() / totalDurationMs.toFloat()).coerceIn(0f, 1f)
    }

    fun afterElapsed(elapsedDurationMs: Long): StoryPlaybackProgressState {
        return copy(
            remainingDurationMs = (remainingDurationMs - elapsedDurationMs).coerceIn(0L, totalDurationMs),
        )
    }

    companion object {
        fun started(totalDurationMs: Long): StoryPlaybackProgressState {
            val normalizedDurationMs = totalDurationMs.coerceAtLeast(1L)
            return StoryPlaybackProgressState(
                totalDurationMs = normalizedDurationMs,
                remainingDurationMs = normalizedDurationMs,
            )
        }
    }
}

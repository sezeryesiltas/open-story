package com.openstory.sdk.internal.ui

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class StoryAvatarRingTest {
    @Test
    fun storyAvatarRingColorsMatchAllPalettes() {
        val defaultColors = storyAvatarRingColors(isViewed = false, isCached = false)
        val cachedColors = storyAvatarRingColors(isViewed = false, isCached = true)
        val viewedColors = storyAvatarRingColors(isViewed = true, isCached = false)

        assertThat(defaultColors.startColor).isEqualTo(0xFFF59E0B.toInt())
        assertThat(defaultColors.endColor).isEqualTo(0xFF8B5CF6.toInt())
        assertThat(cachedColors.startColor).isEqualTo(0xFFC3A173.toInt())
        assertThat(cachedColors.endColor).isEqualTo(0xFFB4845D.toInt())
        assertThat(viewedColors.startColor).isEqualTo(0xFFD8CEC2.toInt())
        assertThat(viewedColors.endColor).isEqualTo(0xFFBDB2A6.toInt())
    }

    @Test
    fun viewerAvatarRingMetricsKeepStoryBarProportions() {
        assertThat(storyAvatarRingDiameterDpForImage(40f)).isWithin(0.01f).of(48.22f)
        assertThat(storyAvatarRingStrokeWidthDpForImage(40f)).isWithin(0.01f).of(2.54f)
    }
}
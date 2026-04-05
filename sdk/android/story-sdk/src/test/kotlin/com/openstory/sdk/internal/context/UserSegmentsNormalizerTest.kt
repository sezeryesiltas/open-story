package com.openstory.sdk.internal.context

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class UserSegmentsNormalizerTest {
    @Test
    fun normalizeTrimsDeduplicatesAndSortsSegments() {
        val normalized = UserSegmentsNormalizer.normalize(
            listOf(" vip ", "beta", "", "vip", "alpha"),
        )

        assertThat(normalized).containsExactly("alpha", "beta", "vip").inOrder()
    }
}

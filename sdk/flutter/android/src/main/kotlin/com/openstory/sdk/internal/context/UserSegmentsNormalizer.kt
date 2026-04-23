package com.openstory.sdk.internal.context

internal object UserSegmentsNormalizer {
    fun normalize(rawSegments: Collection<String>): List<String> {
        return rawSegments
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .sorted()
    }
}

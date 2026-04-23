package com.openstory.sdk.internal.context

import java.util.concurrent.atomic.AtomicReference

internal class UserContextStore {
    private val segmentsRef = AtomicReference<List<String>>(emptyList())

    fun update(userSegments: Collection<String>) {
        segmentsRef.set(UserSegmentsNormalizer.normalize(userSegments))
    }

    fun snapshot(): List<String> = segmentsRef.get()
}

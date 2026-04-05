package com.openstory.sdk

import android.content.Context
import android.view.ViewGroup
import com.openstory.sdk.internal.OpenStoryRuntime

object OpenStory {
    @Volatile
    private var runtime: OpenStoryRuntime? = null

    @Synchronized
    fun initialize(
        context: Context,
        configuration: OpenStoryConfiguration,
    ) {
        runtime?.shutdown()
        runtime = OpenStoryRuntime(
            context = context,
            configuration = configuration,
        )
    }

    fun setUserContext(userSegments: Collection<String>) {
        requireRuntime().updateUserContext(userSegments)
    }

    fun renderStoryBar(
        placementKey: String,
        container: ViewGroup,
        callbacks: OpenStoryCallbacks = object : OpenStoryCallbacks {},
    ) {
        require(placementKey.isNotBlank()) { "placementKey must not be blank." }
        requireRuntime().renderStoryBar(placementKey, container, callbacks)
    }

    fun reload(placementKey: String) {
        require(placementKey.isNotBlank()) { "placementKey must not be blank." }
        requireRuntime().reload(placementKey)
    }

    @Synchronized
    fun resetForTests() {
        runtime?.shutdown()
        runtime = null
    }

    private fun requireRuntime(): OpenStoryRuntime {
        return runtime
            ?: error("OpenStory is not initialized. Call OpenStory.initialize(...) first.")
    }
}

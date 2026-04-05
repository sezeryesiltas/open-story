package com.openstory.sdk

import android.content.Context
import android.graphics.Color
import android.view.ViewGroup
import androidx.annotation.ColorInt
import com.openstory.sdk.internal.OpenStoryRuntime

@ColorInt
private val DEFAULT_STORY_GROUP_TEXT_COLOR: Int = Color.parseColor("#2B1A12")

@ColorInt
private val DEFAULT_VIEWED_STORY_GROUP_TEXT_COLOR: Int = Color.parseColor("#8E8176")

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

    @JvmOverloads
    fun renderStoryBar(
        placementKey: String,
        container: ViewGroup,
        callbacks: OpenStoryCallbacks = object : OpenStoryCallbacks {},
        @ColorInt textColor: Int = DEFAULT_STORY_GROUP_TEXT_COLOR,
        @ColorInt viewedTextColor: Int = DEFAULT_VIEWED_STORY_GROUP_TEXT_COLOR,
    ) {
        require(placementKey.isNotBlank()) { "placementKey must not be blank." }
        requireRuntime().renderStoryBar(
            placementKey = placementKey,
            container = container,
            callbacks = callbacks,
            textColor = textColor,
            viewedTextColor = viewedTextColor,
        )
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

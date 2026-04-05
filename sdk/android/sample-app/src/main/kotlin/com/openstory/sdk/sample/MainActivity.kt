package com.openstory.sdk.sample

import android.os.Bundle
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.openstory.sdk.OpenStory
import com.openstory.sdk.OpenStoryCallbacks
import com.openstory.sdk.OpenStoryConfiguration
import com.openstory.sdk.model.OpenStoryAnalyticsEvent

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val statusView = findViewById<TextView>(R.id.statusView)
        val storyBarContainer = findViewById<FrameLayout>(R.id.storyBarContainer)
        val reloadButton = findViewById<MaterialButton>(R.id.reloadButton)

        val staticToken = BuildConfig.OPEN_STORY_STATIC_TOKEN.trim()
        val placementKey = BuildConfig.OPEN_STORY_PLACEMENT_KEY.trim()
        val userSegments = BuildConfig.OPEN_STORY_USER_SEGMENTS_CSV
            .split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        if (staticToken.isEmpty()) {
            statusView.text = "Missing OPEN_STORY_STATIC_TOKEN in sdk/android/local.properties"
            reloadButton.isEnabled = false
            return
        }

        OpenStory.initialize(
            context = applicationContext,
            configuration = OpenStoryConfiguration(
                clientId = BuildConfig.OPEN_STORY_CLIENT_ID,
                staticToken = staticToken,
                baseUrl = BuildConfig.OPEN_STORY_BASE_URL,
            ),
        )
        OpenStory.setUserContext(userSegments)
        OpenStory.renderStoryBar(
            placementKey = placementKey,
            container = storyBarContainer,
            callbacks = object : OpenStoryCallbacks {
                override fun onStoryBarImpression(event: OpenStoryAnalyticsEvent) {
                    statusView.text = "Rendered ${event.placementKey} for ${userSegments.joinToString()}"
                }

                override fun onError(placementKey: String, throwable: Throwable) {
                    statusView.text = "Load failed for $placementKey: ${throwable.message}"
                }
            },
        )

        reloadButton.setOnClickListener {
            statusView.text = "Reloading..."
            OpenStory.reload(placementKey)
        }
    }
}

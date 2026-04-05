package com.openstory.sdk.sample

import android.os.Bundle
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.openstory.sdk.OpenStory
import com.openstory.sdk.OpenStoryCallbacks
import com.openstory.sdk.OpenStoryConfiguration
import com.openstory.sdk.model.OpenStoryAnalyticsEvent

class MainActivity : AppCompatActivity() {
    private lateinit var bottomNavigation: BottomNavigationView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val toolbar = findViewById<MaterialToolbar>(R.id.topAppBar)
        val statusView = findViewById<TextView>(R.id.statusView)
        val placementKeyView = findViewById<TextView>(R.id.placementKeyView)
        val segmentSummaryView = findViewById<TextView>(R.id.segmentSummaryView)
        val listPlacementView = findViewById<TextView>(R.id.listPlacementView)
        val storyBarContainer = findViewById<FrameLayout>(R.id.storyBarContainer)
        val reloadButton = findViewById<MaterialButton>(R.id.reloadButton)
        val homePage = findViewById<android.view.View>(R.id.homePage)
        val searchPage = findViewById<android.view.View>(R.id.searchPage)
        val listPage = findViewById<android.view.View>(R.id.listPage)
        bottomNavigation = findViewById(R.id.bottomNavigation)

        val staticToken = BuildConfig.OPEN_STORY_STATIC_TOKEN.trim()
        val placementKey = BuildConfig.OPEN_STORY_PLACEMENT_KEY.trim()
        val userSegments = BuildConfig.OPEN_STORY_USER_SEGMENTS_CSV
            .split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        val segmentSummary = userSegments
            .takeIf { it.isNotEmpty() }
            ?.joinToString()
            ?: getString(R.string.sample_all_users)

        placementKeyView.text = placementKey
        segmentSummaryView.text = segmentSummary
        listPlacementView.text = placementKey

        bottomNavigation.setOnItemSelectedListener { item ->
            showDestination(
                selectedItemId = item.itemId,
                toolbar = toolbar,
                homePage = homePage,
                searchPage = searchPage,
                listPage = listPage,
            )
            true
        }
        bottomNavigation.selectedItemId =
            savedInstanceState?.getInt(STATE_SELECTED_TAB) ?: R.id.navigation_home

        if (staticToken.isEmpty()) {
            statusView.text = getString(R.string.sample_status_missing_token)
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
                    statusView.text = getString(
                        R.string.sample_status_rendered,
                        event.placementKey,
                        segmentSummary,
                    )
                }

                override fun onError(placementKey: String, throwable: Throwable) {
                    statusView.text = getString(
                        R.string.sample_status_error,
                        placementKey,
                        throwable.message ?: getString(R.string.sample_unknown_error),
                    )
                }
            },
        )

        reloadButton.setOnClickListener {
            statusView.text = getString(R.string.sample_status_reloading)
            OpenStory.reload(placementKey)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(STATE_SELECTED_TAB, bottomNavigation.selectedItemId)
    }

    private fun showDestination(
        selectedItemId: Int,
        toolbar: MaterialToolbar,
        homePage: android.view.View,
        searchPage: android.view.View,
        listPage: android.view.View,
    ) {
        homePage.isVisible = selectedItemId == R.id.navigation_home
        searchPage.isVisible = selectedItemId == R.id.navigation_search
        listPage.isVisible = selectedItemId == R.id.navigation_list

        toolbar.subtitle = when (selectedItemId) {
            R.id.navigation_search -> getString(R.string.nav_search)
            R.id.navigation_list -> getString(R.string.nav_list)
            else -> getString(R.string.nav_home)
        }
    }

    companion object {
        private const val STATE_SELECTED_TAB = "selected_tab"
    }
}

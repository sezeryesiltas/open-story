package com.openstory.sdk.sample

import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.common.truth.Truth.assertThat
import com.google.android.material.button.MaterialButton
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivitySmokeTest {
    @Test
    fun launchRendersStaticChrome() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val titleView = activity.findViewById<TextView>(R.id.titleView)
                val reloadButton = activity.findViewById<MaterialButton>(R.id.reloadButton)

                assertThat(titleView.text.toString()).isEqualTo("Open Story Android SDK")
                assertThat(reloadButton.isEnabled).isTrue()
            }
        }
    }
}

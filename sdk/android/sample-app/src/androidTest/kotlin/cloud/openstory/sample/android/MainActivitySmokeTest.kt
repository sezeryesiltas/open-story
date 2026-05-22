package cloud.openstory.sample.android

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.common.truth.Truth.assertThat
import com.google.android.material.button.MaterialButton
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.appbar.MaterialToolbar
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivitySmokeTest {
    @Test
    fun launchRendersStaticChrome() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val toolbar = activity.findViewById<MaterialToolbar>(R.id.topAppBar)
                val navigation = activity.findViewById<BottomNavigationView>(R.id.bottomNavigation)
                val reloadButton = activity.findViewById<MaterialButton>(R.id.reloadButton)

                assertThat(toolbar.title.toString()).isEqualTo("Open Story Demo")
                assertThat(navigation.menu.size()).isEqualTo(3)
                assertThat(navigation.selectedItemId).isEqualTo(R.id.navigation_home)
                assertThat(reloadButton.text.toString()).isEqualTo("Reload")
            }
        }
    }
}

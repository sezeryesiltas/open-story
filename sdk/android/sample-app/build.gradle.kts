import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use { load(it) }
    }
}

fun readLocalConfig(key: String, defaultValue: String): String {
    return providers.environmentVariable(key).orNull
        ?: localProperties.getProperty(key)
        ?: defaultValue
}

android {
    namespace = "com.openstory.sdk.sample"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.openstory.sdk.sample"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "OPEN_STORY_CLIENT_ID", "\"${readLocalConfig("OPEN_STORY_CLIENT_ID", "public-client-id")}\"")
        buildConfigField("String", "OPEN_STORY_STATIC_TOKEN", "\"${readLocalConfig("OPEN_STORY_STATIC_TOKEN", "")}\"")
        buildConfigField("String", "OPEN_STORY_BASE_URL", "\"${readLocalConfig("OPEN_STORY_BASE_URL", "http://10.0.2.2:3001")}\"")
        buildConfigField("String", "OPEN_STORY_PLACEMENT_KEY", "\"${readLocalConfig("OPEN_STORY_PLACEMENT_KEY", "home_top_story_bar")}\"")
        buildConfigField("String", "OPEN_STORY_USER_SEGMENTS_CSV", "\"${readLocalConfig("OPEN_STORY_USER_SEGMENTS_CSV", "premium")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(project(":story-sdk"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)

    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.truth)
}

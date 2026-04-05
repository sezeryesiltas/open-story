package com.openstory.sdk.internal.cache

import com.openstory.sdk.internal.context.UserSegmentsNormalizer
import java.security.MessageDigest

internal data class StoryFeedCacheKey(
    val placementKey: String,
    val platform: String,
    val appVersion: String,
    val normalizedUserSegments: List<String>,
    val userSegmentsHash: String,
) {
    val databaseKey: String =
        "$placementKey::$platform::$appVersion::$userSegmentsHash"

    companion object {
        fun create(
            placementKey: String,
            platform: String,
            appVersion: String,
            userSegments: Collection<String>,
        ): StoryFeedCacheKey {
            val normalizedSegments = UserSegmentsNormalizer.normalize(userSegments)
            val digest = MessageDigest.getInstance("SHA-256")
            val bytes = digest.digest(normalizedSegments.joinToString("\n").toByteArray())
            val hash = bytes.joinToString(separator = "") { byte -> "%02x".format(byte) }

            return StoryFeedCacheKey(
                placementKey = placementKey.trim(),
                platform = platform.trim(),
                appVersion = appVersion.trim(),
                normalizedUserSegments = normalizedSegments,
                userSegmentsHash = hash,
            )
        }
    }
}

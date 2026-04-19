import CryptoKit
import Foundation

internal struct StoryFeedCacheKey: Equatable {
    let placementKey: String
    let platform: String
    let appVersion: String
    let normalizedUserSegments: [String]
    let userSegmentsHash: String

    var databaseKey: String {
        "\(placementKey)::\(platform)::\(appVersion)::\(userSegmentsHash)"
    }

    static func create(
        placementKey: String,
        platform: String,
        appVersion: String,
        userSegments: some Collection<String>
    ) -> StoryFeedCacheKey {
        let normalizedUserSegments = UserSegmentsNormalizer.normalize(userSegments)
        let digest = SHA256.hash(
            data: Data(normalizedUserSegments.joined(separator: "\n").utf8)
        )
        let hash = digest.map { String(format: "%02x", $0) }.joined()

        return StoryFeedCacheKey(
            placementKey: placementKey.trimmingCharacters(in: .whitespacesAndNewlines),
            platform: platform.trimmingCharacters(in: .whitespacesAndNewlines),
            appVersion: appVersion.trimmingCharacters(in: .whitespacesAndNewlines),
            normalizedUserSegments: normalizedUserSegments,
            userSegmentsHash: hash
        )
    }
}

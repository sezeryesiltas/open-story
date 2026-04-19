import Foundation

internal struct SdkFeedRequestPayload: Codable, Equatable, Sendable {
    let clientId: String
    let placementKey: String
    let platform: String
    let appVersion: String
    let userSegments: [String]

    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case placementKey = "placement_key"
        case platform
        case appVersion = "app_version"
        case userSegments = "user_segments"
    }
}

internal struct SdkFeedResponsePayload: Codable, Equatable, Sendable {
    let clientId: String
    let placementKey: String
    let context: SdkFeedContextPayload
    let resolvedSet: SdkFeedSetPayload?
    let generatedAt: String

    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case placementKey = "placement_key"
        case context
        case resolvedSet = "resolved_set"
        case generatedAt = "generated_at"
    }
}

internal struct SdkFeedContextPayload: Codable, Equatable, Sendable {
    let platform: String
    let appVersion: String
    let userSegments: [String]

    enum CodingKeys: String, CodingKey {
        case platform
        case appVersion = "app_version"
        case userSegments = "user_segments"
    }
}

internal struct SdkFeedSetPayload: Codable, Equatable, Sendable {
    let id: String
    let revisionId: String
    let placementKey: String
    let isFallback: Bool
    let groups: [SdkFeedGroupPayload]

    enum CodingKeys: String, CodingKey {
        case id
        case revisionId = "revision_id"
        case placementKey = "placement_key"
        case isFallback = "is_fallback"
        case groups
    }
}

internal struct SdkFeedGroupPayload: Codable, Equatable, Sendable {
    let id: String
    let revisionId: String
    let title: String
    let bottomLabel: String?
    let logoURL: String
    let badge: SdkFeedBadgePayload?
    let stories: [SdkFeedStoryPayload]

    enum CodingKeys: String, CodingKey {
        case id
        case revisionId = "revision_id"
        case title
        case bottomLabel = "bottom_label"
        case logoURL = "logo_url"
        case badge
        case stories
    }
}

internal struct SdkFeedBadgePayload: Codable, Equatable, Sendable {
    let type: String
    let value: String
}

internal struct SdkFeedStoryPayload: Codable, Equatable, Sendable {
    let id: String
    let revisionId: String
    let title: String
    let mediaType: String
    let imageDurationMs: Int64?
    let asset: SdkFeedAssetPayload
    let posterAsset: SdkFeedAssetPayload?
    let cta: SdkFeedCtaPayload?

    enum CodingKeys: String, CodingKey {
        case id
        case revisionId = "revision_id"
        case title
        case mediaType = "media_type"
        case imageDurationMs = "image_duration_ms"
        case asset
        case posterAsset = "poster_asset"
        case cta
    }
}

internal struct SdkFeedAssetPayload: Codable, Equatable, Sendable {
    let id: String
    let url: String
    let mimeType: String
    let width: Int?
    let height: Int?
    let durationMs: Int64?

    enum CodingKeys: String, CodingKey {
        case id
        case url
        case mimeType = "mime_type"
        case width
        case height
        case durationMs = "duration_ms"
    }
}

internal struct SdkFeedCtaPayload: Codable, Equatable, Sendable {
    let label: String
    let type: String
    let value: String
}

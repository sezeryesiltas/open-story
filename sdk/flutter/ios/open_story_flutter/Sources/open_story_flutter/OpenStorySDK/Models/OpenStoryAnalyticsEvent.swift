import Foundation

public struct OpenStoryAnalyticsEvent: Sendable, Equatable {
    public enum Kind: String, Sendable {
        case storyBarImpression = "story_bar_impression"
        case storyGroupTap = "story_group_tap"
        case storyView = "story_view"
        case storyComplete = "story_complete"
        case storyCtaTap = "story_cta_tap"
        case viewerClose = "viewer_close"
        case groupComplete = "group_complete"
    }

    public let kind: Kind
    public let placementKey: String
    public let storyGroupId: String?
    public let storyGroupRevisionId: String?
    public let storyId: String?
    public let storyRevisionId: String?
    public let occurredAtMillis: Int64

    public init(
        kind: Kind,
        placementKey: String,
        storyGroupId: String? = nil,
        storyGroupRevisionId: String? = nil,
        storyId: String? = nil,
        storyRevisionId: String? = nil,
        occurredAtMillis: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)
    ) {
        self.kind = kind
        self.placementKey = placementKey
        self.storyGroupId = storyGroupId
        self.storyGroupRevisionId = storyGroupRevisionId
        self.storyId = storyId
        self.storyRevisionId = storyRevisionId
        self.occurredAtMillis = occurredAtMillis
    }
}

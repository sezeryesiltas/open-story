import Foundation

public struct OpenStoryCtaPayload: Sendable, Equatable {
    public enum TargetType: String, Sendable {
        case url
        case deeplink
    }

    public let placementKey: String
    public let storyGroupId: String
    public let storyGroupRevisionId: String
    public let storyId: String
    public let storyRevisionId: String
    public let label: String
    public let targetType: TargetType
    public let targetValue: String

    public init(
        placementKey: String,
        storyGroupId: String,
        storyGroupRevisionId: String,
        storyId: String,
        storyRevisionId: String,
        label: String,
        targetType: TargetType,
        targetValue: String
    ) {
        self.placementKey = placementKey
        self.storyGroupId = storyGroupId
        self.storyGroupRevisionId = storyGroupRevisionId
        self.storyId = storyId
        self.storyRevisionId = storyRevisionId
        self.label = label
        self.targetType = targetType
        self.targetValue = targetValue
    }
}

import Foundation

internal struct ViewedStoryStateSnapshot: Equatable, Sendable {
    let viewedStoryRevisionIds: Set<String>

    func isStoryViewed(_ story: SdkFeedStoryPayload) -> Bool {
        viewedStoryRevisionIds.contains(story.revisionId)
    }

    func isGroupViewed(_ group: SdkFeedGroupPayload) -> Bool {
        !group.stories.isEmpty && group.stories.allSatisfy(isStoryViewed(_:))
    }

    func firstUnviewedStoryIndex(in group: SdkFeedGroupPayload) -> Int {
        if let firstUnviewed = group.stories.firstIndex(where: { !isStoryViewed($0) }) {
            return firstUnviewed
        }
        return 0
    }

    func withViewedStory(_ storyRevisionId: String) -> ViewedStoryStateSnapshot {
        let trimmed = storyRevisionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !viewedStoryRevisionIds.contains(trimmed) else {
            return self
        }

        return ViewedStoryStateSnapshot(
            viewedStoryRevisionIds: viewedStoryRevisionIds.union([trimmed])
        )
    }

    static let empty = ViewedStoryStateSnapshot(viewedStoryRevisionIds: [])
}

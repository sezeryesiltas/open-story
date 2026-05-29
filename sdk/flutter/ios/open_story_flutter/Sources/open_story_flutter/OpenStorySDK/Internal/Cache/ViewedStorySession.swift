import Foundation

internal final class ViewedStorySession {
    private var snapshot: ViewedStoryStateSnapshot
    private let onStoryViewed: (String) -> Void

    init(
        initialSnapshot: ViewedStoryStateSnapshot,
        onStoryViewed: @escaping (String) -> Void
    ) {
        snapshot = initialSnapshot
        self.onStoryViewed = onStoryViewed
    }

    func isGroupViewed(_ group: SdkFeedGroupPayload) -> Bool {
        snapshot.isGroupViewed(group)
    }

    func firstUnviewedStoryIndex(in group: SdkFeedGroupPayload) -> Int {
        snapshot.firstUnviewedStoryIndex(in: group)
    }

    func markStoryViewed(_ storyRevisionId: String) {
        let nextSnapshot = snapshot.withViewedStory(storyRevisionId)
        guard nextSnapshot != snapshot else {
            return
        }

        snapshot = nextSnapshot
        onStoryViewed(storyRevisionId)
    }
}

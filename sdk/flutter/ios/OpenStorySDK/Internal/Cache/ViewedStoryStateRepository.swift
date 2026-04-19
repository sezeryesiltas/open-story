import Foundation

internal final class ViewedStoryStateRepository: @unchecked Sendable {
    private let database: OpenStoryDatabase
    private let lock = NSLock()
    private var isLoaded = false
    private var cachedSnapshot = ViewedStoryStateSnapshot.empty

    init(database: OpenStoryDatabase) {
        self.database = database
    }

    func snapshot() -> ViewedStoryStateSnapshot {
        ensureLoaded()
        return currentSnapshot()
    }

    func currentSnapshot() -> ViewedStoryStateSnapshot {
        lock.lock()
        defer { lock.unlock() }
        return cachedSnapshot
    }

    func markViewed(_ storyRevisionId: String) -> Bool {
        let trimmed = storyRevisionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return false
        }

        ensureLoaded()

        let inserted = lock.withLock { () -> Bool in
            if cachedSnapshot.viewedStoryRevisionIds.contains(trimmed) {
                return false
            }
            cachedSnapshot = cachedSnapshot.withViewedStory(trimmed)
            return true
        }

        guard inserted else {
            return false
        }

        do {
            try database.upsertViewedStoryRevision(
                storyRevisionId: trimmed,
                firstViewedAtEpochMs: Int64(Date().timeIntervalSince1970 * 1_000)
            )
        } catch {
            return false
        }

        return true
    }

    private func ensureLoaded() {
        let shouldLoad = lock.withLock { !isLoaded }

        guard shouldLoad else {
            return
        }

        let viewedStoryRevisionIds = Set(database.allViewedStoryRevisionIds())

        lock.withLock {
            if !isLoaded {
                cachedSnapshot = ViewedStoryStateSnapshot(
                    viewedStoryRevisionIds: viewedStoryRevisionIds
                )
                isLoaded = true
            }
        }
    }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}

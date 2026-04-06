import Foundation

internal final class UserContextStore: @unchecked Sendable {
    private let lock = NSLock()
    private var userSegments: [String] = []

    func update(_ segments: some Collection<String>) {
        let normalized = UserSegmentsNormalizer.normalize(segments)
        lock.lock()
        userSegments = normalized
        lock.unlock()
    }

    func snapshot() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return userSegments
    }
}

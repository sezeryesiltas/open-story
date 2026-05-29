import Foundation

internal enum UserSegmentsNormalizer {
    static func normalize(_ rawSegments: some Collection<String>) -> [String] {
        Array(
            Set(
                rawSegments
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            )
        )
        .sorted()
    }
}

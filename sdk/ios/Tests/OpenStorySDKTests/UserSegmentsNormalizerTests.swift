@testable import OpenStorySDK

import Testing

@Test
func normalizeTrimsDeduplicatesAndSortsSegments() {
    let normalized = UserSegmentsNormalizer.normalize([
        " vip ",
        "beta",
        "",
        "vip",
        "alpha",
    ])

    #expect(normalized == ["alpha", "beta", "vip"])
}

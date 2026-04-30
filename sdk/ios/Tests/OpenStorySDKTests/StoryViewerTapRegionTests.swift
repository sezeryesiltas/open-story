@testable import OpenStorySDK

import Testing

@Test
func tapsInsideFirstQuarterNavigateBackward() {
    #expect(storyViewerTapDirection(tapX: 249, width: 1_000) == .backward)
}

@Test
func tapsAtFirstQuarterBoundaryNavigateForward() {
    #expect(storyViewerTapDirection(tapX: 250, width: 1_000) == .forward)
}

@Test
func tapsAfterFirstQuarterNavigateForward() {
    #expect(storyViewerTapDirection(tapX: 999, width: 1_000) == .forward)
}

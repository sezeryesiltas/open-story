import Foundation

internal enum StoryViewerTapDirection {
    case backward
    case forward
}

internal func storyViewerTapDirection(
    tapX: Double,
    width: Double
) -> StoryViewerTapDirection {
    if tapX < width * storyViewerBackwardTapWidthRatio {
        return .backward
    }

    return .forward
}

private let storyViewerBackwardTapWidthRatio = 0.25

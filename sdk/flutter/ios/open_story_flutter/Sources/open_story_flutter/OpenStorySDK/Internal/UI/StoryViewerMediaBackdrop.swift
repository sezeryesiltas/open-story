import Foundation

internal extension SdkFeedStoryPayload {
    var viewerBackdropImageURL: String? {
        guard mediaType == "video" else {
            return nil
        }

        return posterAsset?.url ?? asset.url
    }
}

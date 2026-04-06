#if canImport(UIKit)
import ObjectiveC
import UIKit

@MainActor
internal enum RemoteImageLoader {
    private static let cache = NSCache<NSURL, UIImage>()
    private static let session = URLSession(configuration: .default)
    private static var associatedKey: UInt8 = 0

    static func loadImage(
        from urlString: String?,
        into imageView: UIImageView
    ) {
        objc_setAssociatedObject(
            imageView,
            &associatedKey,
            urlString,
            .OBJC_ASSOCIATION_RETAIN_NONATOMIC
        )

        guard
            let urlString,
            let url = URL(string: urlString)
        else {
            imageView.image = nil
            return
        }

        let cacheKey = url as NSURL
        if let cachedImage = cache.object(forKey: cacheKey) {
            imageView.image = cachedImage
            return
        }

        session.dataTask(with: url) { data, _, _ in
            guard
                let data,
                let image = UIImage(data: data)
            else {
                return
            }

            Task { @MainActor in
                cache.setObject(image, forKey: cacheKey)
                let expectedURL = objc_getAssociatedObject(imageView, &associatedKey) as? String
                guard expectedURL == urlString else {
                    return
                }
                imageView.image = image
            }
        }.resume()
    }
}
#endif

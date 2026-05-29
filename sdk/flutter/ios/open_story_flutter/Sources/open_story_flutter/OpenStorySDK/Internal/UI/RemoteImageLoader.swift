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
        into imageView: UIImageView,
        onImageSet: (@MainActor @Sendable (UIImage?) -> Void)? = nil
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
            onImageSet?(nil)
            return
        }

        let cacheKey = url as NSURL
        if let cachedImage = cache.object(forKey: cacheKey) {
            imageView.image = cachedImage
            onImageSet?(cachedImage)
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
                onImageSet?(image)
            }
        }.resume()
    }

    static func cachedImage(from urlString: String?) -> UIImage? {
        guard let urlString, let url = URL(string: urlString) else {
            return nil
        }
        return cache.object(forKey: url as NSURL)
    }
}
#endif

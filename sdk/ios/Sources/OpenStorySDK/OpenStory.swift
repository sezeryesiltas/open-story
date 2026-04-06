import Foundation

#if canImport(UIKit)
import UIKit

#endif

@MainActor
public enum OpenStory {
    private static var runtime: OpenStoryRuntime?

    #if canImport(UIKit)
    public static let defaultStoryGroupTitleColor = UIColor(
        red: 43 / 255,
        green: 26 / 255,
        blue: 18 / 255,
        alpha: 1
    )
    public static let defaultViewedStoryGroupTitleColor = UIColor(
        red: 142 / 255,
        green: 129 / 255,
        blue: 118 / 255,
        alpha: 1
    )
    #endif

    public static func initialize(configuration: OpenStoryConfiguration) {
        runtime?.shutdown()
        do {
            runtime = try OpenStoryRuntime(configuration: configuration)
        } catch {
            assertionFailure("OpenStory initialization failed: \(error)")
            runtime = nil
        }
    }

    public static func setUserContext(_ userSegments: some Collection<String>) {
        guard let runtime else {
            assertionFailure("OpenStory is not initialized. Call OpenStory.initialize(configuration:) first.")
            return
        }
        runtime.updateUserContext(userSegments)
    }

    public static func reload(placementKey: String) {
        guard let runtime else {
            assertionFailure("OpenStory is not initialized. Call OpenStory.initialize(configuration:) first.")
            return
        }
        runtime.reload(placementKey: placementKey)
    }

    static func resetForTests() {
        runtime?.shutdown()
        runtime = nil
    }

    #if canImport(UIKit)
    public static func renderStoryBar(
        placementKey: String,
        in container: UIView,
        callbacks: (any OpenStoryCallbacks)? = nil,
        titleColor: UIColor = OpenStory.defaultStoryGroupTitleColor,
        viewedTitleColor: UIColor = OpenStory.defaultViewedStoryGroupTitleColor
    ) {
        guard let runtime else {
            assertionFailure("OpenStory is not initialized. Call OpenStory.initialize(configuration:) first.")
            return
        }
        runtime.renderStoryBar(
            placementKey: placementKey,
            container: container,
            callbacks: callbacks,
            titleColor: titleColor,
            viewedTitleColor: viewedTitleColor
        )
    }
    #endif
}

# open-story iOS SDK

Native iOS SDK foundation for the v1 Story Bar Platform.

## Current status

Implemented in this phase:

- Swift Package build under `sdk/ios`
- public SDK bootstrap API
- typed SDK feed models
- URLSession feed client
- SQLite-backed feed snapshot cache
- local viewed-state persistence by `story_revision_id`
- cache-key and user-context normalization utilities
- UIKit story bar
- UIKit fullscreen viewer
- UIKit sample host app
- CTA and analytics callback wiring
- core parity tests for cache, normalization, loopback URL rewriting, viewed-state, and playback timing

Not implemented yet:

- media file prefetch / disk cache
- final packaging / distribution flow

## Platform goals

- UIKit-only fixed UI
- cache-backed feed loading
- revision-aware local viewed state
- `401/403` responses invalidate cached feed for the placement context
- minimal native dependencies

## Package layout

```text
sdk/ios/
  Package.swift
  Sources/OpenStorySDK/
  Tests/OpenStorySDKTests/
  sample-app/
  scripts/
```

## Build prerequisites

- Xcode 16.2+
- Swift 6+

## Commands

From `sdk/ios`:

```bash
swift build
swift test
ruby scripts/generate_sample_app_project.rb
xcodebuild \
  -project sample-app/OpenStorySample.xcodeproj \
  -scheme OpenStorySample \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Sample host app

The sample host app lives in `sdk/ios/sample-app` and links the local `OpenStorySDK`
package through `sample-app/OpenStorySample.xcodeproj`.

It is intentionally narrow and only covers:

- SDK bootstrap with static-token auth
- placement render + reload flow
- tab-based UIKit host shell
- callback visibility for impressions, viewer events, CTA, and errors

Configuration is read from Xcode scheme environment variables first, then
`sample-app/OpenStorySample/Info.plist`.

## Public API shape

Current iOS entrypoint:

```swift
import OpenStorySDK
import UIKit

@MainActor
final class StoryHostViewController: UIViewController, OpenStoryCallbacks {
    @IBOutlet private weak var storyContainer: UIView!

    override func viewDidLoad() {
        super.viewDidLoad()

        OpenStory.initialize(
            configuration: OpenStoryConfiguration(
                clientId: "public-client-id",
                staticToken: "token-value",
                baseURL: "http://127.0.0.1:3001"
            )
        )

        OpenStory.setUserContext(["vip", "beta"])
        OpenStory.renderStoryBar(
            placementKey: "home_top_story_bar",
            in: storyContainer,
            callbacks: self
        )
    }
}
```

## Notes

- `OpenStory` public API is currently `@MainActor` isolated.
- The SDK rewrites loopback asset URLs to match the configured `baseURL` host.
- Viewed state is local-only and keyed by story revision.
- Package tests currently cover the shared logic layer; UI parity can be extended with host-driven integration tests next.

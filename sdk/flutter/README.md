# open-story Flutter SDK

Minimal Flutter wrapper for the native `open-story` Android and iOS SDKs.

This package keeps the Flutter layer intentionally thin:

- no third-party Dart dependencies
- native story bar and viewer remain the source of truth
- Flutter embeds the native story bar with platform views
- CTA and analytics callbacks are bridged back to Dart

## Package status

Current scope:

- Android + iOS only
- SDK bootstrap API
- user-segment context updates
- placement reload
- native story bar rendering in Flutter
- CTA and analytics callbacks

Not included:

- Flutter sample app
- web, desktop, or theming support
- a second implementation of the viewer in Dart

## Integration

This package vendors version-controlled snapshots of the native Android and iOS
SDKs under `android/` and `ios/`. That keeps the Flutter package self-contained
for path, git, or copied-directory usage, while preserving native viewer/cache
behavior.

The iOS wrapper supports both CocoaPods and Flutter Swift Package Manager. The
CocoaPods spec remains at `ios/open_story_flutter.podspec`; the Swift package
manifest is at `ios/open_story_flutter/Package.swift`.

The Android wrapper currently uses Flutter 3.44's KGP compatibility path so
host apps can keep building while AGP built-in Kotlin support settles. It
applies the Kotlin Gradle Plugin intentionally, so Flutter may list
`open_story_flutter` in the KGP warning. Room code generation still uses KSP
`2.2.20-2.0.4`; Room is pinned to `2.7.2` so KSP2 is supported while preserving
the SDK's `minSdkVersion 21`.

When the sibling native SDKs change in this repository, update the vendored
snapshots intentionally with:

```bash
./tool/sync_native_sdks.sh
```

See [docs/flutter-sdk-integration.md](../../docs/flutter-sdk-integration.md)
for the full setup guide.

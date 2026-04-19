# Flutter SDK Integration

Developer guide for integrating the `open-story` Flutter SDK into a host app.

## Scope

This Flutter SDK stays intentionally narrow:

- Android and iOS only
- wraps the existing native SDK implementations
- renders the fixed native story bar through platform views
- reuses native viewer, cache, viewed-state, CTA, and analytics behavior
- keeps Dart-side dependencies minimal

It does not include:

- a Flutter sample app
- a second viewer implementation in Dart
- web, desktop, or theming support

## Package location

The package lives at `sdk/flutter`.

It is not a standalone pub package yet. The Android and iOS plugin layers reuse
the sibling native SDK sources under `sdk/android` and `sdk/ios`, so integrate
it in one of these ways:

1. local path dependency to this repository checkout
2. git dependency that preserves the repository layout and points to `sdk/flutter`

Do not copy only `sdk/flutter` into another repository without also changing the
native source references inside the plugin.

## Host prerequisites

### Flutter

- Flutter 3.22 or newer
- Dart 3.3 or newer

### Android host app

- `minSdkVersion 21`
- JDK 17
- Android Gradle Plugin / Gradle setup compatible with Kotlin 2.x

The plugin carries `INTERNET` and `ACCESS_NETWORK_STATE` in its Android
manifest, so those permissions merge into the host app automatically.

### iOS host app

- iOS deployment target `15.0`
- CocoaPods enabled Flutter iOS project
- Xcode toolchain capable of building the existing native iOS SDK

Set your `ios/Podfile` platform to at least `15.0` if it is lower today.

## Add the dependency

### Local path dependency

Use this when your Flutter sample app lives on the same machine:

```yaml
dependencies:
  open_story_flutter:
    path: /absolute/path/to/open-story/sdk/flutter
```

### Git dependency

Use this when the host app should pull directly from the monorepo:

```yaml
dependencies:
  open_story_flutter:
    git:
      url: git@github.com:sezeryesiltas/open-story.git
      ref: main
      path: sdk/flutter
```

After updating `pubspec.yaml`, run:

```bash
flutter pub get
```

## Public API

The Flutter API mirrors the native conceptual API:

- `OpenStory.initialize(...)`
- `OpenStory.setUserContext(...)`
- `OpenStory.reload(...)`
- `OpenStoryBar(...)`

## Bootstrap

Initialize once during app startup:

```dart
import "package:flutter/material.dart";
import "package:open_story_flutter/open_story_flutter.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await OpenStory.initialize(
    configuration: const OpenStoryConfiguration(
      clientId: "public-client-id",
      staticToken: "replace-me",
      baseUrl: "https://api.example.com",
    ),
  );

  runApp(const MyApp());
}
```

## User context

User segments are owned by the host app. Context changes do not auto-reload the
feed. That behavior is preserved in Flutter as well.

```dart
await OpenStory.setUserContext(<String>["vip", "beta"]);
await OpenStory.reload("home_top_story_bar");
```

## Base URL rule

Pass the API origin root in `baseUrl`.

Use:

```dart
baseUrl: "https://api.example.com"
```

Do not pass a nested API path such as:

```dart
baseUrl: "https://api.example.com/api"
```

The native SDK appends `/v1/sdk/feed` internally, so using `/api` in the base
URL would incorrectly request `/api/v1/sdk/feed`.

## Render the story bar

`OpenStoryBar` embeds the native story bar with a Flutter platform view. Give it
an explicit height. The default height is `106`, which matches the current
native host layouts.

```dart
class HomeStories extends StatelessWidget {
  const HomeStories({super.key});

  @override
  Widget build(BuildContext context) {
    return OpenStoryBar(
      placementKey: "home_top_story_bar",
      titleColor: const Color(0xFF2B1A12),
      viewedTitleColor: const Color(0xFF8E8176),
      onStoryBarImpression: (event) {
        debugPrint("story bar impression: ${event.placementKey}");
      },
      onStoryGroupTap: (event) {
        debugPrint("group tap: ${event.storyGroupId}");
      },
      onStoryView: (event) {
        debugPrint("story view: ${event.storyRevisionId}");
      },
      onStoryComplete: (event) {
        debugPrint("story complete: ${event.storyRevisionId}");
      },
      onStoryCtaTap: (payload) {
        debugPrint("cta: ${payload.targetType} ${payload.targetValue}");
      },
      onViewerClose: (event) {
        debugPrint("viewer close: ${event.placementKey}");
      },
      onGroupComplete: (event) {
        debugPrint("group complete: ${event.storyGroupRevisionId}");
      },
      onError: (error) {
        debugPrint("open story error: ${error.message}");
      },
    );
  }
}
```

## Callback payloads

The Flutter bridge forwards the same host-side signals that the native SDKs
already expose:

- `story_bar_impression`
- `story_group_tap`
- `story_view`
- `story_complete`
- `story_cta_tap`
- `viewer_close`
- `group_complete`
- `error`

CTA callbacks include:

- placement key
- group id and group revision id
- story id and story revision id
- CTA label
- target type
- target value

The SDK still never performs navigation on its own. The host app owns URL or
deeplink handling after it receives the CTA callback.

## Runtime behavior

The Flutter wrapper does not change the native caching and authorization rules:

- cache-first render remains enabled
- background refresh remains enabled
- viewed state stays local-device only and revision-aware
- `401/403` responses suppress cached rendering for that placement context
- `placement_key` is still supplied at render time, not initialization time

## Current dependency policy

The Dart package intentionally has no third-party Dart dependencies beyond the
Flutter SDK itself.

Native behavior is delegated to the existing SDKs:

- Android keeps using the current battle-tested native stack already in the repo
- iOS keeps using the current Swift/UIKit implementation already in the repo

That keeps the Flutter layer narrow and avoids a parallel implementation of
cache, viewer, media, or viewed-state logic in Dart.

## No sample app

There is no Flutter sample app in this repository on purpose. Use your existing
sample app to integrate and verify:

1. bootstrap
2. story bar render
3. refresh and cache behavior
4. CTA callback wiring
5. unauthorized `401/403` behavior
6. viewed-state reset after new revisions

## Local verification commands

If Flutter is installed on your machine, these are the expected package-level
commands:

```bash
cd sdk/flutter
flutter pub get
flutter test
flutter analyze
```

The current Codex environment used for this change did not have the `flutter`
binary available, so the commands above were not executed here.

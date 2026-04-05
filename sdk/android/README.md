# open-story Android SDK

Native Android SDK foundation for the v1 Story Bar Platform.

## Current status

Bootstrap phase is in progress.

Implemented in this phase:

- independent Gradle build under `sdk/android`
- `story-sdk` Android library module
- `sample-app` host application module
- public SDK bootstrap API
- typed SDK feed models
- Room cache schema foundation
- cache-key and user-context normalization utilities
- initial developer quickstart

Not implemented yet:

- production story bar UI
- fullscreen viewer
- viewed-state driven bar visuals
- media prefetch pipeline
- final analytics/viewer lifecycle wiring

## Platform goals

- `minSdk 21` for broad device support
- Android View based UI only
- main-thread safe public API
- all disk and network work off the main thread
- cache-first + background refresh behavior
- `401/403` responses must suppress cached rendering

## Module layout

```text
sdk/android/
  story-sdk/     # Android library
  sample-app/    # integration playground
```

## Build prerequisites

- Android SDK installed locally
- JDK 17+ available

If your shell does not expose local Node tooling for repo scripts, use:

```bash
PATH="$HOME/.local/bin:$PATH"
```

## Commands

From `sdk/android`:

```bash
./gradlew :story-sdk:assembleDebug
./gradlew :story-sdk:testDebugUnitTest
./gradlew :sample-app:installDebug
```

## Local sample config

Set sample app runtime values in `sdk/android/local.properties`:

```properties
sdk.dir=/Users/you/Library/Android/sdk
OPEN_STORY_CLIENT_ID=public-client-id
OPEN_STORY_STATIC_TOKEN=replace-me
OPEN_STORY_BASE_URL=http://10.0.2.2:3001
OPEN_STORY_PLACEMENT_KEY=home_top_story_bar
OPEN_STORY_USER_SEGMENTS_CSV=premium
```

These values are local-only and ignored by git.

## Public API shape

Current Android entrypoint:

```kotlin
OpenStory.initialize(
    context = applicationContext,
    configuration = OpenStoryConfiguration(
        clientId = "public-client-id",
        staticToken = "token-value",
        baseUrl = "http://10.0.2.2:3001"
    )
)

OpenStory.setUserContext(listOf("vip", "beta"))
OpenStory.renderStoryBar(
    placementKey = "home_top_story_bar",
    container = container,
    textColor = Color.WHITE,
    viewedTextColor = Color.parseColor("#CFCFCF"),
    callbacks = callbacks,
)
OpenStory.reload("home_top_story_bar")
```

`textColor` is used while the group still has at least one unviewed story. `viewedTextColor` is used once every story in that group has been viewed on the device.

## Threading rules

- public calls hop to the main thread when needed
- network and Room access run on `Dispatchers.IO`
- runtime uses `SupervisorJob` so one failing placement load does not cancel the SDK
- `applicationContext` is held, never an `Activity`

## Cache model

- feed snapshots are keyed by `placement_key + platform + app_version + normalized user_segments hash`
- viewed state is modeled separately by `story_revision_id`
- snapshot payload is stored as raw JSON so contract changes remain explicit

## Local sample app

`sample-app` now acts as a narrow demo host app. It keeps the SDK integration surface small, but adds dark app chrome with `Home`, `Search`, and `List` bottom navigation so the story bar can be exercised in a more realistic shell.

Use `http://10.0.2.2:3001` when running the backend on the same machine and the sample app in the Android emulator.

## Developer notes

- keep dependencies minimal and battle-tested
- do not block the UI thread for network, DB, bitmap decode, or media probing
- preserve fixed UI constraints from the PRD; theming hooks are out of scope for v1
- contract drift must be caught in `packages/contracts` first, then mirrored here

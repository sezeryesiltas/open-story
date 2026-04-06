# OpenStorySample

Minimal iOS host application for exercising the local `OpenStorySDK` package.

## What it covers

- package integration through a local Swift package dependency
- placement reload flow
- tab-bar host shell
- callback visibility for impressions, viewer activity, CTA, and errors

## Configuration

The app reads config in this order:

1. Xcode scheme environment variables
2. `OpenStorySample/Info.plist`

Supported keys:

- `OPEN_STORY_CLIENT_ID`
- `OPEN_STORY_STATIC_TOKEN`
- `OPEN_STORY_BASE_URL`
- `OPEN_STORY_PLACEMENT_KEY`
- `OPEN_STORY_USER_SEGMENTS_CSV`

Default base URL is `http://127.0.0.1:3001`, which works for the iOS Simulator when the API runs on the same Mac.

## Regenerate project

From `sdk/ios`:

```bash
ruby scripts/generate_sample_app_project.rb
```

## Build

```bash
xcodebuild \
  -project sample-app/OpenStorySample.xcodeproj \
  -scheme OpenStorySample \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

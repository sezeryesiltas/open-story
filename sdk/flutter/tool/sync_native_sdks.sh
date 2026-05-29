#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: sync_native_sdks.sh [--check]

Syncs the native iOS and Android SDK sources into sdk/flutter so the Flutter
package remains self-contained. Use --check to verify that the vendored
snapshots are up to date without modifying files.
EOF
}

repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
mode="sync"

if [[ $# -gt 1 ]]; then
  usage
  exit 1
fi

if [[ $# -eq 1 ]]; then
  case "$1" in
    --check)
      mode="check"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
fi

ios_source="$repo_root/sdk/ios/Sources/OpenStorySDK"
ios_target="$repo_root/sdk/flutter/ios/open_story_flutter/Sources/open_story_flutter/OpenStorySDK"

android_source_root="$repo_root/sdk/android/story-sdk/src/main"
android_target_root="$repo_root/sdk/flutter/android/src/main"
android_source_sdk="$android_source_root/kotlin/com/openstory/sdk"
android_target_sdk="$android_target_root/kotlin/com/openstory/sdk"
android_source_res="$android_source_root/res"
android_target_res="$android_target_root/res"
android_consumer_rules_source="$repo_root/sdk/android/story-sdk/consumer-rules.pro"
android_consumer_rules_target="$repo_root/sdk/flutter/android/consumer-rules.pro"

check_dir_sync() {
  local label="$1"
  local source="$2"
  local target="$3"
  local exclude="${4:-}"
  local output

  if [[ -n "$exclude" ]]; then
    output="$(rsync -an --delete --exclude "$exclude" "$source/" "$target/" 2>/dev/null || true)"
  else
    output="$(rsync -an --delete "$source/" "$target/" 2>/dev/null || true)"
  fi
  if [[ -n "$output" ]]; then
    echo "$label is out of sync:"
    echo "$output"
    return 1
  fi
}

check_file_sync() {
  local label="$1"
  local source="$2"
  local target="$3"

  if [[ ! -f "$target" ]] || ! cmp -s "$source" "$target"; then
    echo "$label is out of sync: $target"
    return 1
  fi
}

sync_ios() {
  mkdir -p "$ios_target"
  rsync -a --delete "$ios_source/" "$ios_target/"
}

sync_android() {
  mkdir -p "$android_target_sdk"
  rsync -a --delete --exclude "flutter/" "$android_source_sdk/" "$android_target_sdk/"

  mkdir -p "$android_target_res"
  rsync -a --delete "$android_source_res/" "$android_target_res/"
  rsync -a "$android_consumer_rules_source" "$android_consumer_rules_target"
}

check_sync() {
  local failed=0

  check_dir_sync "iOS OpenStorySDK" "$ios_source" "$ios_target" || failed=1
  check_dir_sync \
    "Android native sources" \
    "$android_source_sdk" \
    "$android_target_sdk" \
    "flutter/" || failed=1
  check_dir_sync "Android resources" "$android_source_res" "$android_target_res" || failed=1

  check_file_sync \
    "Android consumer rules" \
    "$android_consumer_rules_source" \
    "$android_consumer_rules_target" || failed=1

  if [[ $failed -ne 0 ]]; then
    exit 1
  fi

  echo "Flutter vendored native SDK snapshots are in sync."
}

if [[ "$mode" == "check" ]]; then
  check_sync
  exit 0
fi

sync_ios
sync_android
echo "Synced native iOS and Android SDK snapshots into sdk/flutter."

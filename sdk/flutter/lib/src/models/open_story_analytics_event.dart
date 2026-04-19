import "../internal/channel_payload.dart";

enum OpenStoryAnalyticsEventKind {
  storyBarImpression("story_bar_impression"),
  storyGroupTap("story_group_tap"),
  storyView("story_view"),
  storyComplete("story_complete"),
  storyCtaTap("story_cta_tap"),
  viewerClose("viewer_close"),
  groupComplete("group_complete");

  const OpenStoryAnalyticsEventKind(this.wireValue);

  final String wireValue;

  static OpenStoryAnalyticsEventKind fromWireValue(String value) {
    return OpenStoryAnalyticsEventKind.values.firstWhere(
      (OpenStoryAnalyticsEventKind kind) => kind.wireValue == value,
      orElse: () => throw FormatException(
        "Unsupported OpenStory analytics event kind: $value",
      ),
    );
  }
}

class OpenStoryAnalyticsEvent {
  const OpenStoryAnalyticsEvent({
    required this.kind,
    required this.placementKey,
    required this.occurredAtMillis,
    this.storyGroupId,
    this.storyGroupRevisionId,
    this.storyId,
    this.storyRevisionId,
  });

  factory OpenStoryAnalyticsEvent.fromMap(Map<String, Object?> map) {
    return OpenStoryAnalyticsEvent(
      kind: OpenStoryAnalyticsEventKind.fromWireValue(
        readRequiredString(map, "kind"),
      ),
      placementKey: readRequiredString(map, "placementKey"),
      storyGroupId: readOptionalString(map, "storyGroupId"),
      storyGroupRevisionId: readOptionalString(map, "storyGroupRevisionId"),
      storyId: readOptionalString(map, "storyId"),
      storyRevisionId: readOptionalString(map, "storyRevisionId"),
      occurredAtMillis: readRequiredInt(map, "occurredAtMillis"),
    );
  }

  final OpenStoryAnalyticsEventKind kind;
  final String placementKey;
  final String? storyGroupId;
  final String? storyGroupRevisionId;
  final String? storyId;
  final String? storyRevisionId;
  final int occurredAtMillis;
}

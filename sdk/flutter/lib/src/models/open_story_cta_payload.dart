import "../internal/channel_payload.dart";

enum OpenStoryCtaTargetType {
  url("url"),
  deeplink("deeplink");

  const OpenStoryCtaTargetType(this.wireValue);

  final String wireValue;

  static OpenStoryCtaTargetType fromWireValue(String value) {
    return OpenStoryCtaTargetType.values.firstWhere(
      (OpenStoryCtaTargetType kind) => kind.wireValue == value,
      orElse: () => throw FormatException(
        "Unsupported OpenStory CTA target type: $value",
      ),
    );
  }
}

class OpenStoryCtaPayload {
  const OpenStoryCtaPayload({
    required this.placementKey,
    required this.storyGroupId,
    required this.storyGroupRevisionId,
    required this.storyId,
    required this.storyRevisionId,
    required this.label,
    required this.targetType,
    required this.targetValue,
  });

  factory OpenStoryCtaPayload.fromMap(Map<String, Object?> map) {
    return OpenStoryCtaPayload(
      placementKey: readRequiredString(map, "placementKey"),
      storyGroupId: readRequiredString(map, "storyGroupId"),
      storyGroupRevisionId: readRequiredString(map, "storyGroupRevisionId"),
      storyId: readRequiredString(map, "storyId"),
      storyRevisionId: readRequiredString(map, "storyRevisionId"),
      label: readRequiredString(map, "label"),
      targetType: OpenStoryCtaTargetType.fromWireValue(
        readRequiredString(map, "targetType"),
      ),
      targetValue: readRequiredString(map, "targetValue"),
    );
  }

  final String placementKey;
  final String storyGroupId;
  final String storyGroupRevisionId;
  final String storyId;
  final String storyRevisionId;
  final String label;
  final OpenStoryCtaTargetType targetType;
  final String targetValue;
}

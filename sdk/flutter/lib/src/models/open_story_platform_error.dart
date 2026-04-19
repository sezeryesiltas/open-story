import "../internal/channel_payload.dart";

class OpenStoryPlatformError {
  const OpenStoryPlatformError({
    required this.placementKey,
    required this.message,
    this.code,
    this.errorType,
  });

  factory OpenStoryPlatformError.fromMap(Map<String, Object?> map) {
    return OpenStoryPlatformError(
      placementKey: readRequiredString(map, "placementKey"),
      message: readRequiredString(map, "message"),
      code: readOptionalString(map, "code"),
      errorType: readOptionalString(map, "errorType"),
    );
  }

  final String placementKey;
  final String message;
  final String? code;
  final String? errorType;
}

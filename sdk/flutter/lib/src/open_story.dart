import "package:flutter/services.dart";

import "models/open_story_configuration.dart";

class OpenStory {
  OpenStory._();

  static const MethodChannel _methodChannel = MethodChannel(
    "open_story_flutter/methods",
  );

  static Future<void> initialize({
    required OpenStoryConfiguration configuration,
  }) {
    _requireNonBlank(configuration.clientId, "clientId");
    _requireNonBlank(configuration.staticToken, "staticToken");
    _requireNonBlank(configuration.baseUrl, "baseUrl");

    return _methodChannel.invokeMethod<void>("initialize", configuration.toMap());
  }

  static Future<void> setUserContext(Iterable<String> userSegments) {
    return _methodChannel.invokeMethod<void>("setUserContext", <String, Object>{
      "userSegments": userSegments.toList(growable: false),
    });
  }

  static Future<void> reload(String placementKey) {
    _requireNonBlank(placementKey, "placementKey");

    return _methodChannel.invokeMethod<void>("reload", <String, Object>{
      "placementKey": placementKey,
    });
  }

  static void _requireNonBlank(String value, String fieldName) {
    if (value.trim().isEmpty) {
      throw ArgumentError.value(value, fieldName, "$fieldName must not be blank.");
    }
  }
}

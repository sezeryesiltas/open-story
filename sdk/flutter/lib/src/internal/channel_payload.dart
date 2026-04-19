Map<String, Object?> readOpenStoryMap(Object? value) {
  if (value is! Map) {
    throw const FormatException("Expected a map payload from OpenStory.");
  }

  return value.map(
    (Object? key, Object? entryValue) => MapEntry(key.toString(), entryValue),
  );
}

String readRequiredString(Map<String, Object?> map, String key) {
  final Object? value = map[key];
  if (value is String) {
    return value;
  }

  throw FormatException('Expected "$key" to be a string.');
}

String? readOptionalString(Map<String, Object?> map, String key) {
  final Object? value = map[key];
  if (value == null) {
    return null;
  }
  if (value is String) {
    return value;
  }

  throw FormatException('Expected "$key" to be a string when present.');
}

int readRequiredInt(Map<String, Object?> map, String key) {
  final Object? value = map[key];
  if (value is num) {
    return value.toInt();
  }

  throw FormatException('Expected "$key" to be a number.');
}

import "package:flutter_test/flutter_test.dart";
import "package:open_story_flutter/open_story_flutter.dart";

void main() {
  group("OpenStoryConfiguration", () {
    test("serializes method-channel payload", () {
      const OpenStoryConfiguration configuration = OpenStoryConfiguration(
        clientId: "public-client-id",
        staticToken: "static-token",
        baseUrl: "https://api.example.com",
        connectTimeoutMillis: 7000,
        readTimeoutMillis: 15000,
      );

      expect(configuration.toMap(), <String, Object>{
        "clientId": "public-client-id",
        "staticToken": "static-token",
        "baseUrl": "https://api.example.com",
        "connectTimeoutMillis": 7000,
        "readTimeoutMillis": 15000,
      });
    });
  });

  group("OpenStoryAnalyticsEvent", () {
    test("parses analytics callback payload", () {
      final OpenStoryAnalyticsEvent event = OpenStoryAnalyticsEvent.fromMap(
        <String, Object?>{
          "type": "analytics",
          "kind": "story_view",
          "placementKey": "home_top_story_bar",
          "storyGroupId": "group_1",
          "storyGroupRevisionId": "group_rev_2",
          "storyId": "story_3",
          "storyRevisionId": "story_rev_4",
          "occurredAtMillis": 1713512345000,
        },
      );

      expect(event.kind, OpenStoryAnalyticsEventKind.storyView);
      expect(event.placementKey, "home_top_story_bar");
      expect(event.storyGroupId, "group_1");
      expect(event.storyGroupRevisionId, "group_rev_2");
      expect(event.storyId, "story_3");
      expect(event.storyRevisionId, "story_rev_4");
      expect(event.occurredAtMillis, 1713512345000);
    });
  });

  group("OpenStoryCtaPayload", () {
    test("parses CTA callback payload", () {
      final OpenStoryCtaPayload payload = OpenStoryCtaPayload.fromMap(
        <String, Object?>{
          "type": "cta",
          "placementKey": "home_top_story_bar",
          "storyGroupId": "group_1",
          "storyGroupRevisionId": "group_rev_2",
          "storyId": "story_3",
          "storyRevisionId": "story_rev_4",
          "label": "Open Offer",
          "targetType": "deeplink",
          "targetValue": "myapp://offers/42",
        },
      );

      expect(payload.placementKey, "home_top_story_bar");
      expect(payload.storyGroupId, "group_1");
      expect(payload.storyGroupRevisionId, "group_rev_2");
      expect(payload.storyId, "story_3");
      expect(payload.storyRevisionId, "story_rev_4");
      expect(payload.label, "Open Offer");
      expect(payload.targetType, OpenStoryCtaTargetType.deeplink);
      expect(payload.targetValue, "myapp://offers/42");
    });
  });

  group("OpenStoryPlatformError", () {
    test("parses error callback payload", () {
      final OpenStoryPlatformError error = OpenStoryPlatformError.fromMap(
        <String, Object?>{
          "type": "error",
          "placementKey": "home_top_story_bar",
          "message": "Story access is unauthorized.",
          "code": "401",
          "errorType": "AuthorizationError",
        },
      );

      expect(error.placementKey, "home_top_story_bar");
      expect(error.message, "Story access is unauthorized.");
      expect(error.code, "401");
      expect(error.errorType, "AuthorizationError");
    });
  });
}

import Flutter
import Foundation

final class OpenStoryEventStreamHandler: NSObject, FlutterStreamHandler {
    private var eventSink: FlutterEventSink?
    private var bufferedEvents = [[String: Any]]()
    private var closed = false

    func onListen(
        withArguments arguments: Any?,
        eventSink events: @escaping FlutterEventSink
    ) -> FlutterError? {
        self.eventSink = events
        let pendingEvents = bufferedEvents
        bufferedEvents.removeAll()
        pendingEvents.forEach { events($0) }
        return nil
    }

    func onCancel(withArguments arguments: Any?) -> FlutterError? {
        eventSink = nil
        return nil
    }

    func send(_ event: [String: Any]) {
        guard !closed else {
            return
        }

        if let eventSink {
            eventSink(event)
            return
        }

        bufferedEvents.append(event)
    }

    func close() {
        closed = true
        eventSink = nil
        bufferedEvents.removeAll()
    }
}

@MainActor
final class OpenStoryFlutterCallbacks: NSObject, OpenStoryCallbacks {
    private let streamHandler: OpenStoryEventStreamHandler

    init(streamHandler: OpenStoryEventStreamHandler) {
        self.streamHandler = streamHandler
        super.init()
    }

    func onStoryBarImpression(event: OpenStoryAnalyticsEvent) {
        streamHandler.send(analyticsPayload(from: event))
    }

    func onStoryGroupTap(event: OpenStoryAnalyticsEvent) {
        streamHandler.send(analyticsPayload(from: event))
    }

    func onStoryView(event: OpenStoryAnalyticsEvent) {
        streamHandler.send(analyticsPayload(from: event))
    }

    func onStoryComplete(event: OpenStoryAnalyticsEvent) {
        streamHandler.send(analyticsPayload(from: event))
    }

    func onStoryCtaTap(payload: OpenStoryCtaPayload) {
        streamHandler.send(ctaPayload(from: payload))
    }

    func onViewerClose(event: OpenStoryAnalyticsEvent) {
        streamHandler.send(analyticsPayload(from: event))
    }

    func onGroupComplete(event: OpenStoryAnalyticsEvent) {
        streamHandler.send(analyticsPayload(from: event))
    }

    func onError(placementKey: String, error: any Error) {
        let nsError = error as NSError
        var payload: [String: Any] = [
            "type": "error",
            "placementKey": placementKey,
            "message": nsError.localizedDescription,
            "code": String(nsError.code),
            "errorType": String(describing: type(of: error)),
        ]
        if payload["message"] as? String == nil || (payload["message"] as? String)?.isEmpty == true {
            payload["message"] = "Unknown OpenStory error."
        }
        streamHandler.send(payload)
    }

    private func analyticsPayload(from event: OpenStoryAnalyticsEvent) -> [String: Any] {
        var payload: [String: Any] = [
            "type": "analytics",
            "kind": event.kind.rawValue,
            "placementKey": event.placementKey,
            "occurredAtMillis": event.occurredAtMillis,
        ]

        if let storyGroupId = event.storyGroupId {
            payload["storyGroupId"] = storyGroupId
        }
        if let storyGroupRevisionId = event.storyGroupRevisionId {
            payload["storyGroupRevisionId"] = storyGroupRevisionId
        }
        if let storyId = event.storyId {
            payload["storyId"] = storyId
        }
        if let storyRevisionId = event.storyRevisionId {
            payload["storyRevisionId"] = storyRevisionId
        }

        return payload
    }

    private func ctaPayload(from payload: OpenStoryCtaPayload) -> [String: Any] {
        [
            "type": "cta",
            "placementKey": payload.placementKey,
            "storyGroupId": payload.storyGroupId,
            "storyGroupRevisionId": payload.storyGroupRevisionId,
            "storyId": payload.storyId,
            "storyRevisionId": payload.storyRevisionId,
            "label": payload.label,
            "targetType": payload.targetType.rawValue,
            "targetValue": payload.targetValue,
        ]
    }
}

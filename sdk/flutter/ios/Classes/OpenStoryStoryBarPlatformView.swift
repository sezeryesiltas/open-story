import Flutter
import UIKit

final class OpenStoryStoryBarPlatformView: NSObject, FlutterPlatformView {
    private let containerView: UIView
    private let streamHandler: OpenStoryEventStreamHandler
    private let eventChannel: FlutterEventChannel
    private let callbacks: OpenStoryFlutterCallbacks

    init(
        frame: CGRect,
        viewId: Int64,
        arguments: Any?,
        messenger: FlutterBinaryMessenger
    ) {
        containerView = UIView(frame: frame)
        containerView.backgroundColor = .clear
        streamHandler = OpenStoryEventStreamHandler()

        let payload = arguments as? [String: Any] ?? [:]
        let callbackChannelName = (payload["callbackChannel"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            ?? "open_story_flutter/events/\(viewId)"
        eventChannel = FlutterEventChannel(
            name: callbackChannelName,
            binaryMessenger: messenger
        )
        callbacks = OpenStoryFlutterCallbacks(streamHandler: streamHandler)

        super.init()

        eventChannel.setStreamHandler(streamHandler)

        guard
            let placementKey = (payload["placementKey"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !placementKey.isEmpty
        else {
            streamHandler.send(
                [
                    "type": "error",
                    "placementKey": "",
                    "message": "placementKey must not be blank.",
                    "errorType": "ArgumentError",
                ]
            )
            return
        }

        let titleColor = Self.color(from: payload["titleColorValue"])
            ?? OpenStory.defaultStoryGroupTitleColor
        let viewedTitleColor = Self.color(from: payload["viewedTitleColorValue"])
            ?? OpenStory.defaultViewedStoryGroupTitleColor

        Task { @MainActor [weak self] in
            guard let self else { return }
            OpenStory.renderStoryBar(
                placementKey: placementKey,
                in: self.containerView,
                callbacks: self.callbacks,
                titleColor: titleColor,
                viewedTitleColor: viewedTitleColor
            )
        }
    }

    func view() -> UIView {
        containerView
    }

    func dispose() {
        eventChannel.setStreamHandler(nil)
        streamHandler.close()
        Task { @MainActor [weak containerView] in
            containerView?.subviews.forEach { $0.removeFromSuperview() }
        }
    }

    private static func color(from value: Any?) -> UIColor? {
        guard let rawValue = value as? NSNumber else {
            return nil
        }

        let argb = rawValue.uint32Value
        let alpha = CGFloat((argb >> 24) & 0xff) / 255
        let red = CGFloat((argb >> 16) & 0xff) / 255
        let green = CGFloat((argb >> 8) & 0xff) / 255
        let blue = CGFloat(argb & 0xff) / 255
        return UIColor(red: red, green: green, blue: blue, alpha: alpha)
    }
}

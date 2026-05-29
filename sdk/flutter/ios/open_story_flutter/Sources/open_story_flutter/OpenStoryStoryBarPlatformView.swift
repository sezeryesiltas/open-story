import Flutter
import UIKit

final class OpenStoryStoryBarPlatformView: NSObject, FlutterPlatformView {
    private let containerView: UIView
    private let streamHandler: OpenStoryEventStreamHandler
    private let eventChannel: FlutterEventChannel
    private var callbacks: OpenStoryFlutterCallbacks?

    init(
        frame: CGRect,
        viewId: Int64,
        arguments: Any?,
        messenger: FlutterBinaryMessenger
    ) {
        containerView = UIView(frame: frame)
        containerView.backgroundColor = .clear
        containerView.clipsToBounds = true
        streamHandler = OpenStoryEventStreamHandler()

        let payload = arguments as? [String: Any] ?? [:]
        let callbackChannelName = (payload["callbackChannel"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            ?? "open_story_flutter/events/\(viewId)"
        eventChannel = FlutterEventChannel(
            name: callbackChannelName,
            binaryMessenger: messenger
        )

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
            ?? Self.defaultStoryGroupTitleColor
        let viewedTitleColor = Self.color(from: payload["viewedTitleColorValue"])
            ?? Self.defaultViewedStoryGroupTitleColor

        Task { @MainActor [weak self] in
            guard let self else { return }
            let callbacks = OpenStoryFlutterCallbacks(streamHandler: self.streamHandler)
            self.callbacks = callbacks
            OpenStory.renderStoryBar(
                placementKey: placementKey,
                in: self.containerView,
                callbacks: callbacks,
                titleColor: titleColor,
                viewedTitleColor: viewedTitleColor
            )
        }
    }

    func view() -> UIView {
        containerView
    }

    func dispose() {
        streamHandler.close()
        DispatchQueue.main.async { [eventChannel] in
            eventChannel.setStreamHandler(nil)
        }
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

    private static let defaultStoryGroupTitleColor = UIColor(
        red: 43 / 255,
        green: 26 / 255,
        blue: 18 / 255,
        alpha: 1
    )

    private static let defaultViewedStoryGroupTitleColor = UIColor(
        red: 142 / 255,
        green: 129 / 255,
        blue: 118 / 255,
        alpha: 1
    )
}

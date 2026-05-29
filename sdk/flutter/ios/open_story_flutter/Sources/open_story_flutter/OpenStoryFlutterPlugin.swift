import Flutter
import UIKit

public final class OpenStoryFlutterPlugin: NSObject, FlutterPlugin {
    public static func register(with registrar: FlutterPluginRegistrar) {
        let methodChannel = FlutterMethodChannel(
            name: Self.methodChannelName,
            binaryMessenger: registrar.messenger()
        )
        let instance = OpenStoryFlutterPlugin()
        registrar.addMethodCallDelegate(instance, channel: methodChannel)
        registrar.register(
            OpenStoryStoryBarViewFactory(messenger: registrar.messenger()),
            withId: Self.viewTypeName
        )
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "initialize":
            handleInitialize(call.arguments, result: result)
        case "setUserContext":
            handleSetUserContext(call.arguments, result: result)
        case "reload":
            handleReload(call.arguments, result: result)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private func handleInitialize(_ arguments: Any?, result: @escaping FlutterResult) {
        do {
            let payload = try dictionary(from: arguments)
            let clientId = try requiredString(in: payload, key: "clientId")
            let staticToken = try requiredString(in: payload, key: "staticToken")
            let baseURL = try requiredString(in: payload, key: "baseUrl")
            let connectTimeoutMillis = try requiredMilliseconds(
                in: payload,
                key: "connectTimeoutMillis"
            )
            let readTimeoutMillis = try requiredMilliseconds(
                in: payload,
                key: "readTimeoutMillis"
            )

            Task { @MainActor in
                OpenStory.initialize(
                    configuration: OpenStoryConfiguration(
                        clientId: clientId,
                        staticToken: staticToken,
                        baseURL: baseURL,
                        requestTimeoutInterval: Double(connectTimeoutMillis) / 1000,
                        resourceTimeoutInterval: Double(readTimeoutMillis) / 1000
                    )
                )
                result(nil)
            }
        } catch let error as OpenStoryFlutterPluginError {
            result(Self.invalidArgumentsError(message: error.message))
        } catch {
            result(Self.invalidArgumentsError(message: error.localizedDescription))
        }
    }

    private func handleSetUserContext(_ arguments: Any?, result: @escaping FlutterResult) {
        do {
            let payload = try dictionary(from: arguments)
            let userSegments = try requiredStringArray(in: payload, key: "userSegments")

            Task { @MainActor in
                OpenStory.setUserContext(userSegments)
                result(nil)
            }
        } catch let error as OpenStoryFlutterPluginError {
            result(Self.invalidArgumentsError(message: error.message))
        } catch {
            result(Self.invalidArgumentsError(message: error.localizedDescription))
        }
    }

    private func handleReload(_ arguments: Any?, result: @escaping FlutterResult) {
        do {
            let payload = try dictionary(from: arguments)
            let placementKey = try requiredString(in: payload, key: "placementKey")

            Task { @MainActor in
                OpenStory.reload(placementKey: placementKey)
                result(nil)
            }
        } catch let error as OpenStoryFlutterPluginError {
            result(Self.invalidArgumentsError(message: error.message))
        } catch {
            result(Self.invalidArgumentsError(message: error.localizedDescription))
        }
    }

    private func dictionary(from arguments: Any?) throws -> [String: Any] {
        guard let dictionary = arguments as? [String: Any] else {
            throw OpenStoryFlutterPluginError(message: "Method arguments must be a map.")
        }
        return dictionary
    }

    private func requiredString(
        in dictionary: [String: Any],
        key: String
    ) throws -> String {
        guard let value = dictionary[key] as? String else {
            throw OpenStoryFlutterPluginError(message: "\(key) must be a string.")
        }
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw OpenStoryFlutterPluginError(message: "\(key) must not be blank.")
        }
        return value
    }

    private func requiredMilliseconds(
        in dictionary: [String: Any],
        key: String
    ) throws -> Int {
        guard let value = dictionary[key] as? NSNumber else {
            throw OpenStoryFlutterPluginError(message: "\(key) must be a number.")
        }
        let milliseconds = value.intValue
        guard milliseconds > 0 else {
            throw OpenStoryFlutterPluginError(message: "\(key) must be positive.")
        }
        return milliseconds
    }

    private func requiredStringArray(
        in dictionary: [String: Any],
        key: String
    ) throws -> [String] {
        guard let values = dictionary[key] as? [Any] else {
            throw OpenStoryFlutterPluginError(message: "\(key) must be a list of strings.")
        }

        return try values.enumerated().map { index, value in
            guard let stringValue = value as? String else {
                throw OpenStoryFlutterPluginError(
                    message: "\(key)[\(index)] must be a string."
                )
            }
            return stringValue
        }
    }

    private static func invalidArgumentsError(message: String) -> FlutterError {
        FlutterError(
            code: "open_story_invalid_arguments",
            message: message,
            details: nil
        )
    }

    private static let methodChannelName = "open_story_flutter/methods"
    fileprivate static let viewTypeName = "open_story_flutter/story_bar"
}

private struct OpenStoryFlutterPluginError: Error {
    let message: String
}

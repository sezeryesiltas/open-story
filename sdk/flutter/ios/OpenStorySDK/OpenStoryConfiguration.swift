import Foundation

public struct OpenStoryConfiguration: Sendable {
    public let clientId: String
    public let staticToken: String
    public let baseURL: String
    public let requestTimeoutInterval: TimeInterval
    public let resourceTimeoutInterval: TimeInterval

    public init(
        clientId: String,
        staticToken: String,
        baseURL: String,
        requestTimeoutInterval: TimeInterval = 5,
        resourceTimeoutInterval: TimeInterval = 10
    ) {
        precondition(!clientId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "clientId must not be blank.")
        precondition(!staticToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "staticToken must not be blank.")
        precondition(!baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "baseURL must not be blank.")
        precondition(requestTimeoutInterval > 0, "requestTimeoutInterval must be positive.")
        precondition(resourceTimeoutInterval > 0, "resourceTimeoutInterval must be positive.")

        self.clientId = clientId
        self.staticToken = staticToken
        self.baseURL = baseURL
        self.requestTimeoutInterval = requestTimeoutInterval
        self.resourceTimeoutInterval = resourceTimeoutInterval
    }

    internal var normalizedBaseURL: String {
        baseURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}

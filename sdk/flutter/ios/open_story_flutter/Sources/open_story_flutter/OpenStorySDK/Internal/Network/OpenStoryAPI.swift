import Foundation

internal struct OpenStoryAuthorizationError: Error, Equatable {
    let statusCode: Int
}

internal final class OpenStoryAPI: @unchecked Sendable {
    private let baseURL: String
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(
        configuration: OpenStoryConfiguration,
        session: URLSession? = nil
    ) {
        baseURL = configuration.normalizedBaseURL

        if let session {
            self.session = session
        } else {
            let sessionConfiguration = URLSessionConfiguration.ephemeral
            sessionConfiguration.timeoutIntervalForRequest = configuration.requestTimeoutInterval
            sessionConfiguration.timeoutIntervalForResource = configuration.resourceTimeoutInterval
            self.session = URLSession(configuration: sessionConfiguration)
        }
    }

    func fetchFeed(
        requestPayload: SdkFeedRequestPayload,
        staticToken: String
    ) async throws -> SdkFeedResponsePayload {
        guard let url = URL(string: "\(baseURL)/v1/sdk/feed") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(staticToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(requestPayload)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        switch httpResponse.statusCode {
        case 401, 403:
            throw OpenStoryAuthorizationError(statusCode: httpResponse.statusCode)
        case 200 ..< 300:
            let decoded = try decoder.decode(SdkFeedResponsePayload.self, from: data)
            return SdkFeedResponseNormalizer.normalizeLoopbackURLs(
                response: decoded,
                baseURL: baseURL
            )
        default:
            throw NSError(
                domain: "OpenStoryAPI",
                code: httpResponse.statusCode,
                userInfo: [
                    NSLocalizedDescriptionKey: "Story feed request failed with HTTP \(httpResponse.statusCode)."
                ]
            )
        }
    }
}

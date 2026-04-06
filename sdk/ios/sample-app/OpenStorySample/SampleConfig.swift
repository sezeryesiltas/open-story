import Foundation

struct SampleConfig {
    let clientId: String
    let staticToken: String
    let baseURL: String
    let placementKey: String
    let userSegments: [String]

    static func current() -> SampleConfig {
        let environment = ProcessInfo.processInfo.environment
        let info = Bundle.main.infoDictionary ?? [:]

        func stringValue(
            key: String,
            default defaultValue: String
        ) -> String {
            let envValue = environment[key]?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let envValue, !envValue.isEmpty {
                return envValue
            }

            let infoValue = (info[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let infoValue, !infoValue.isEmpty {
                return infoValue
            }

            return defaultValue
        }

        let segmentsCSV = stringValue(
            key: "OPEN_STORY_USER_SEGMENTS_CSV",
            default: "premium"
        )

        return SampleConfig(
            clientId: stringValue(
                key: "OPEN_STORY_CLIENT_ID",
                default: "public-client-id"
            ),
            staticToken: stringValue(
                key: "OPEN_STORY_STATIC_TOKEN",
                default: ""
            ),
            baseURL: stringValue(
                key: "OPEN_STORY_BASE_URL",
                default: "http://127.0.0.1:3001"
            ),
            placementKey: stringValue(
                key: "OPEN_STORY_PLACEMENT_KEY",
                default: "home_top_story_bar"
            ),
            userSegments: segmentsCSV
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        )
    }

    var segmentSummary: String {
        userSegments.isEmpty ? "all users" : userSegments.joined(separator: ", ")
    }

    var hasStaticToken: Bool {
        !staticToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

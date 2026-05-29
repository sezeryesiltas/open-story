import Foundation

internal final class OpenStoryRuntime: @unchecked Sendable {
    let configuration: OpenStoryConfiguration
    private let appVersionProvider = AppVersionProvider()
    private let userContextStore = UserContextStore()
    let api: OpenStoryAPI
    let database: OpenStoryDatabase
    let viewedStoryStateRepository: ViewedStoryStateRepository
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    #if canImport(UIKit)
    var storyBarsByPlacement: [String: NSHashTable<StoryBarView>] = [:]
    var latestSnapshotsByPlacement: [String: SdkFeedResponsePayload] = [:]
    var reloadTasks: [String: Task<Void, Never>] = [:]
    #endif

    init(configuration: OpenStoryConfiguration) throws {
        self.configuration = configuration
        let database = try OpenStoryDatabase()
        self.database = database
        api = OpenStoryAPI(configuration: configuration)
        viewedStoryStateRepository = ViewedStoryStateRepository(database: database)
    }

    func updateUserContext(_ userSegments: some Collection<String>) {
        userContextStore.update(userSegments)
    }

    func buildRequestPayload(placementKey: String) -> SdkFeedRequestPayload {
        SdkFeedRequestPayload(
            clientId: configuration.clientId,
            placementKey: placementKey.trimmingCharacters(in: .whitespacesAndNewlines),
            platform: "ios",
            appVersion: appVersionProvider.versionName(),
            userSegments: userContextStore.snapshot()
        )
    }

    func decodeSnapshot(json payloadJSON: String) -> SdkFeedResponsePayload? {
        guard let data = payloadJSON.data(using: .utf8) else {
            return nil
        }
        return try? decoder.decode(SdkFeedResponsePayload.self, from: data)
    }

    func encodeSnapshot(_ payload: SdkFeedResponsePayload) -> String? {
        guard let data = try? encoder.encode(payload) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    func markStoryViewed(_ storyRevisionId: String) {
        Task { [weak self] in
            guard let self else { return }
            let inserted = viewedStoryStateRepository.markViewed(storyRevisionId)
            guard inserted else { return }
            #if canImport(UIKit)
            await MainActor.run {
                self.refreshVisibleStoryBars()
            }
            #endif
        }
    }

    func shutdown() {
        #if canImport(UIKit)
        reloadTasks.values.forEach { $0.cancel() }
        reloadTasks.removeAll()
        latestSnapshotsByPlacement.removeAll()
        storyBarsByPlacement.removeAll()
        #endif
    }

    #if !canImport(UIKit)
    func reload(placementKey: String) {}
    #endif
}

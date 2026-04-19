#if canImport(UIKit)
import UIKit

@MainActor
extension OpenStoryRuntime {
    func renderStoryBar(
        placementKey: String,
        container: UIView,
        callbacks: (any OpenStoryCallbacks)?,
        titleColor: UIColor,
        viewedTitleColor: UIColor
    ) {
        let trimmedPlacementKey = placementKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPlacementKey.isEmpty else {
            preconditionFailure("placementKey must not be blank.")
        }

        let view = ensureStoryBarView(in: container)
        view.updateCallbacks(callbacks)
        view.updateViewerLauncher(viewerLauncher())
        view.updateTitleColors(titleColor: titleColor, viewedTitleColor: viewedTitleColor)
        register(placementKey: trimmedPlacementKey, storyBarView: view)
        view.showLoading()
        startLoadPlacement(trimmedPlacementKey)
    }

    func reload(placementKey: String) {
        let trimmedPlacementKey = placementKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPlacementKey.isEmpty else {
            preconditionFailure("placementKey must not be blank.")
        }
        startLoadPlacement(trimmedPlacementKey)
    }

    func refreshVisibleStoryBars() {
        let viewedState = viewedStoryStateRepository.snapshot()
        for (placementKey, snapshot) in latestSnapshotsByPlacement {
            renderSnapshot(
                placementKey: placementKey,
                snapshot: snapshot,
                isCached: false,
                viewedState: viewedState
            )
        }
    }

    private func startLoadPlacement(_ placementKey: String) {
        let requestPayload = buildRequestPayload(placementKey: placementKey)
        let cacheKey = StoryFeedCacheKey.create(
            placementKey: placementKey,
            platform: requestPayload.platform,
            appVersion: requestPayload.appVersion,
            userSegments: requestPayload.userSegments
        )

        reloadTasks[placementKey]?.cancel()
        let task = Task { [weak self] in
            guard let self else { return }

            let cachedEntity = database.findFeedSnapshot(cacheKey: cacheKey.databaseKey)
            let viewedState = viewedStoryStateRepository.snapshot()
            var cachedSnapshot: SdkFeedResponsePayload?

            if let cachedEntity {
                cachedSnapshot = decodeSnapshot(json: cachedEntity.payloadJSON)
                if cachedSnapshot == nil {
                    try? database.deleteFeedSnapshot(cacheKey: cacheKey.databaseKey)
                }
            }

            await MainActor.run {
                self.renderLoading(placementKey: placementKey)
            }

            do {
                let response = try await api.fetchFeed(
                    requestPayload: requestPayload,
                    staticToken: configuration.staticToken
                )

                if let responseJSON = encodeSnapshot(response) {
                    try? database.upsertFeedSnapshot(
                        StoryFeedSnapshotRecord(
                            cacheKey: cacheKey.databaseKey,
                            placementKey: cacheKey.placementKey,
                            platform: cacheKey.platform,
                            appVersion: cacheKey.appVersion,
                            userSegmentsHash: cacheKey.userSegmentsHash,
                            payloadJSON: responseJSON,
                            updatedAtEpochMs: Int64(Date().timeIntervalSince1970 * 1_000)
                        )
                    )
                }

                let latestViewedState = viewedStoryStateRepository.snapshot()
                await MainActor.run {
                    self.renderSnapshot(
                        placementKey: cacheKey.placementKey,
                        snapshot: response,
                        isCached: false,
                        viewedState: latestViewedState
                    )
                }
            } catch let authorizationError as OpenStoryAuthorizationError {
                try? database.deleteFeedSnapshot(cacheKey: cacheKey.databaseKey)
                await MainActor.run {
                    self.renderUnauthorized(placementKey: placementKey)
                    self.notifyError(placementKey: placementKey, error: authorizationError)
                }
            } catch {
                await MainActor.run {
                    if let cachedSnapshot {
                        self.renderSnapshot(
                            placementKey: cacheKey.placementKey,
                            snapshot: cachedSnapshot,
                            isCached: true,
                            viewedState: viewedState
                        )
                    } else {
                        self.renderError(placementKey: placementKey)
                    }
                    self.notifyError(placementKey: placementKey, error: error)
                }
            }

            await MainActor.run {
                self.reloadTasks.removeValue(forKey: placementKey)
            }
        }

        reloadTasks[placementKey] = task
    }

    private func renderSnapshot(
        placementKey: String,
        snapshot: SdkFeedResponsePayload,
        isCached: Bool,
        viewedState: ViewedStoryStateSnapshot
    ) {
        latestSnapshotsByPlacement[placementKey] = snapshot
        registeredViews(for: placementKey).forEach {
            $0.renderSnapshot(
                response: snapshot,
                isCached: isCached,
                viewedState: viewedState
            )
        }
    }

    private func renderLoading(placementKey: String) {
        registeredViews(for: placementKey).forEach { $0.showLoading() }
    }

    private func renderError(placementKey: String) {
        latestSnapshotsByPlacement.removeValue(forKey: placementKey)
        registeredViews(for: placementKey).forEach { $0.showEmpty("Unable to load stories.") }
    }

    private func renderUnauthorized(placementKey: String) {
        latestSnapshotsByPlacement.removeValue(forKey: placementKey)
        registeredViews(for: placementKey).forEach { $0.showEmpty("Story access is unauthorized.") }
    }

    private func notifyError(
        placementKey: String,
        error: Error
    ) {
        registeredViews(for: placementKey).forEach {
            $0.dispatchError(placementKey: placementKey, error: error)
        }
    }

    private func ensureStoryBarView(in container: UIView) -> StoryBarView {
        if let existingView = container.viewWithTag(storyBarTag) as? StoryBarView {
            return existingView
        }

        container.subviews.forEach { $0.removeFromSuperview() }
        let view = StoryBarView()
        view.tag = storyBarTag
        view.translatesAutoresizingMaskIntoConstraints = false
        view.updateViewerLauncher(viewerLauncher())
        container.addSubview(view)

        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: container.topAnchor),
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        return view
    }

    private func viewerLauncher() -> StoryBarView.ViewerLauncher {
        { [weak self] anchorView, response, initialGroupIndex, group, callbacks in
            guard let self else { return }
            let viewedStorySession = ViewedStorySession(
                initialSnapshot: viewedStoryStateRepository.currentSnapshot(),
                onStoryViewed: { [weak self] storyRevisionId in
                    self?.markStoryViewed(storyRevisionId)
                }
            )
            let opened = StoryViewerViewController.show(
                anchorView: anchorView,
                response: response,
                initialGroupIndex: initialGroupIndex,
                initialStoryIndex: viewedStorySession.firstUnviewedStoryIndex(in: group),
                viewedStorySession: viewedStorySession,
                callbacks: callbacks
            )

            if !opened {
                callbacks?.onError(
                    placementKey: response.placementKey,
                    error: NSError(
                        domain: "OpenStory",
                        code: 2,
                        userInfo: [NSLocalizedDescriptionKey: "Story viewer requires a view-controller-backed context."]
                    )
                )
            }
        }
    }

    private func register(
        placementKey: String,
        storyBarView: StoryBarView
    ) {
        for (registeredPlacementKey, table) in storyBarsByPlacement {
            table.allObjects.forEach { view in
                if view === storyBarView {
                    table.remove(view)
                }
            }
            if table.allObjects.isEmpty {
                storyBarsByPlacement.removeValue(forKey: registeredPlacementKey)
            }
        }

        let table = storyBarsByPlacement[placementKey] ?? NSHashTable<StoryBarView>.weakObjects()
        table.add(storyBarView)
        storyBarsByPlacement[placementKey] = table
    }

    private func registeredViews(for placementKey: String) -> [StoryBarView] {
        let table = storyBarsByPlacement[placementKey] ?? NSHashTable<StoryBarView>.weakObjects()
        let views = table.allObjects
        if views.isEmpty {
            storyBarsByPlacement.removeValue(forKey: placementKey)
        }
        return views
    }

    private var storyBarTag: Int {
        730_021
    }
}
#endif

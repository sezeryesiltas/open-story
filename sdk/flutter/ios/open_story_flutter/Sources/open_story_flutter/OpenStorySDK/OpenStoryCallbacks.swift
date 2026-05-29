import Foundation

@MainActor
public protocol OpenStoryCallbacks: AnyObject {
    func onStoryBarVisibilityChanged(placementKey: String, isVisible: Bool)
    func onStoryBarImpression(event: OpenStoryAnalyticsEvent)
    func onStoryGroupTap(event: OpenStoryAnalyticsEvent)
    func onStoryView(event: OpenStoryAnalyticsEvent)
    func onStoryComplete(event: OpenStoryAnalyticsEvent)
    func onStoryCtaTap(payload: OpenStoryCtaPayload)
    func onViewerClose(event: OpenStoryAnalyticsEvent)
    func onGroupComplete(event: OpenStoryAnalyticsEvent)
    func onError(placementKey: String, error: Error)
}

@MainActor
public extension OpenStoryCallbacks {
    func onStoryBarVisibilityChanged(placementKey: String, isVisible: Bool) {}
    func onStoryBarImpression(event: OpenStoryAnalyticsEvent) {}
    func onStoryGroupTap(event: OpenStoryAnalyticsEvent) {}
    func onStoryView(event: OpenStoryAnalyticsEvent) {}
    func onStoryComplete(event: OpenStoryAnalyticsEvent) {}
    func onStoryCtaTap(payload: OpenStoryCtaPayload) {}
    func onViewerClose(event: OpenStoryAnalyticsEvent) {}
    func onGroupComplete(event: OpenStoryAnalyticsEvent) {}
    func onError(placementKey: String, error: Error) {}
}

import Foundation

internal enum SdkFeedResponseNormalizer {
    static func normalizeLoopbackURLs(
        response: SdkFeedResponsePayload,
        baseURL: String
    ) -> SdkFeedResponsePayload {
        guard
            let baseComponents = URLComponents(string: baseURL),
            let baseScheme = baseComponents.scheme,
            let baseHost = baseComponents.host
        else {
            return response
        }

        let basePort = baseComponents.port ?? defaultPort(for: baseScheme)

        func rewrite(_ value: String) -> String {
            guard var components = URLComponents(string: value) else {
                return value
            }

            let host = components.host?.lowercased() ?? ""
            guard host == "localhost" || host == "127.0.0.1" else {
                return value
            }

            components.scheme = baseScheme
            components.host = baseHost
            components.port = basePort
            return components.string ?? value
        }

        let rewrittenGroups = response.resolvedSet?.groups.map { group in
            SdkFeedGroupPayload(
                id: group.id,
                revisionId: group.revisionId,
                title: group.title,
                bottomLabel: group.bottomLabel,
                logoURL: rewrite(group.logoURL),
                badge: group.badge,
                stories: group.stories.map { story in
                    SdkFeedStoryPayload(
                        id: story.id,
                        revisionId: story.revisionId,
                        title: story.title,
                        mediaType: story.mediaType,
                        imageDurationMs: story.imageDurationMs,
                        asset: SdkFeedAssetPayload(
                            id: story.asset.id,
                            url: rewrite(story.asset.url),
                            mimeType: story.asset.mimeType,
                            width: story.asset.width,
                            height: story.asset.height,
                            durationMs: story.asset.durationMs
                        ),
                        posterAsset: story.posterAsset.map {
                            SdkFeedAssetPayload(
                                id: $0.id,
                                url: rewrite($0.url),
                                mimeType: $0.mimeType,
                                width: $0.width,
                                height: $0.height,
                                durationMs: $0.durationMs
                            )
                        },
                        cta: story.cta
                    )
                }
            )
        }

        return SdkFeedResponsePayload(
            clientId: response.clientId,
            placementKey: response.placementKey,
            context: response.context,
            resolvedSet: response.resolvedSet.map {
                SdkFeedSetPayload(
                    id: $0.id,
                    revisionId: $0.revisionId,
                    placementKey: $0.placementKey,
                    isFallback: $0.isFallback,
                    groups: rewrittenGroups ?? []
                )
            },
            generatedAt: response.generatedAt
        )
    }

    private static func defaultPort(for scheme: String) -> Int? {
        switch scheme.lowercased() {
        case "http":
            return 80
        case "https":
            return 443
        default:
            return nil
        }
    }
}

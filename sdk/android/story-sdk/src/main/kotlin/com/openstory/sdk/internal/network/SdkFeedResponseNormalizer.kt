package com.openstory.sdk.internal.network

import java.net.URI

internal object SdkFeedResponseNormalizer {
    fun normalizeLoopbackUrls(
        response: SdkFeedResponsePayload,
        baseUrl: String,
    ): SdkFeedResponsePayload {
        val baseUri = runCatching { URI(baseUrl) }.getOrNull() ?: return response
        val baseScheme = baseUri.scheme ?: return response
        val baseHost = baseUri.host ?: return response
        val basePort = if (baseUri.port == -1) {
            defaultPort(baseScheme)
        } else {
            baseUri.port
        }

        fun rewrite(url: String): String {
            val uri = runCatching { URI(url) }.getOrNull() ?: return url
            val host = uri.host?.lowercase() ?: return url
            if (host != LOOPBACK_HOST && host != LOOPBACK_IP) {
                return url
            }

            return URI(
                baseScheme,
                uri.userInfo,
                baseHost,
                basePort,
                uri.path,
                uri.query,
                uri.fragment,
            ).toString()
        }

        return response.copy(
            resolvedSet = response.resolvedSet?.copy(
                groups = response.resolvedSet.groups.map { group ->
                    group.copy(
                        logoUrl = rewrite(group.logoUrl),
                        stories = group.stories.map { story ->
                            story.copy(
                                asset = story.asset.copy(url = rewrite(story.asset.url)),
                                posterAsset = story.posterAsset?.copy(url = rewrite(story.posterAsset.url)),
                            )
                        },
                    )
                },
            ),
        )
    }

    private fun defaultPort(scheme: String): Int {
        return when (scheme.lowercase()) {
            "http" -> 80
            "https" -> 443
            else -> -1
        }
    }

    private const val LOOPBACK_HOST = "localhost"
    private const val LOOPBACK_IP = "127.0.0.1"
}

package com.openstory.sdk.internal.network

internal data class SdkFeedRequestPayload(
    val clientId: String,
    val placementKey: String,
    val platform: String,
    val appVersion: String,
    val userSegments: List<String>,
)

internal data class SdkFeedResponsePayload(
    val clientId: String,
    val placementKey: String,
    val context: SdkFeedContextPayload,
    val resolvedSet: SdkFeedSetPayload? = null,
    val generatedAt: String,
)

internal data class SdkFeedContextPayload(
    val platform: String,
    val appVersion: String,
    val userSegments: List<String>,
)

internal data class SdkFeedSetPayload(
    val id: String,
    val revisionId: String,
    val placementKey: String,
    val isFallback: Boolean,
    val groups: List<SdkFeedGroupPayload>,
)

internal data class SdkFeedGroupPayload(
    val id: String,
    val revisionId: String,
    val title: String,
    val bottomLabel: String? = null,
    val logoUrl: String,
    val badge: SdkFeedBadgePayload? = null,
    val stories: List<SdkFeedStoryPayload>,
)

internal data class SdkFeedBadgePayload(
    val type: String,
    val value: String,
)

internal data class SdkFeedStoryPayload(
    val id: String,
    val revisionId: String,
    val title: String,
    val mediaType: String,
    val imageDurationMs: Long? = null,
    val asset: SdkFeedAssetPayload,
    val posterAsset: SdkFeedAssetPayload? = null,
    val cta: SdkFeedCtaPayload? = null,
)

internal data class SdkFeedAssetPayload(
    val id: String,
    val url: String,
    val mimeType: String,
    val width: Int? = null,
    val height: Int? = null,
    val durationMs: Long? = null,
)

internal data class SdkFeedCtaPayload(
    val label: String,
    val type: String,
    val value: String,
)

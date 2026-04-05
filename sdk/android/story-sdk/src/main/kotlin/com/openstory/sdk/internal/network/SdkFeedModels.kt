package com.openstory.sdk.internal.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
internal data class SdkFeedRequestPayload(
    @SerialName("client_id")
    val clientId: String,
    @SerialName("placement_key")
    val placementKey: String,
    val platform: String,
    @SerialName("app_version")
    val appVersion: String,
    @SerialName("user_segments")
    val userSegments: List<String>,
)

@Serializable
internal data class SdkFeedResponsePayload(
    @SerialName("client_id")
    val clientId: String,
    @SerialName("placement_key")
    val placementKey: String,
    val context: SdkFeedContextPayload,
    @SerialName("resolved_set")
    val resolvedSet: SdkFeedSetPayload? = null,
    @SerialName("generated_at")
    val generatedAt: String,
)

@Serializable
internal data class SdkFeedContextPayload(
    val platform: String,
    @SerialName("app_version")
    val appVersion: String,
    @SerialName("user_segments")
    val userSegments: List<String>,
)

@Serializable
internal data class SdkFeedSetPayload(
    val id: String,
    @SerialName("revision_id")
    val revisionId: String,
    @SerialName("placement_key")
    val placementKey: String,
    @SerialName("is_fallback")
    val isFallback: Boolean,
    val groups: List<SdkFeedGroupPayload>,
)

@Serializable
internal data class SdkFeedGroupPayload(
    val id: String,
    @SerialName("revision_id")
    val revisionId: String,
    val title: String,
    @SerialName("bottom_label")
    val bottomLabel: String? = null,
    @SerialName("logo_url")
    val logoUrl: String,
    val badge: SdkFeedBadgePayload? = null,
    val stories: List<SdkFeedStoryPayload>,
)

@Serializable
internal data class SdkFeedBadgePayload(
    val type: String,
    val value: String,
)

@Serializable
internal data class SdkFeedStoryPayload(
    val id: String,
    @SerialName("revision_id")
    val revisionId: String,
    val title: String,
    @SerialName("media_type")
    val mediaType: String,
    @SerialName("image_duration_ms")
    val imageDurationMs: Long? = null,
    val asset: SdkFeedAssetPayload,
    @SerialName("poster_asset")
    val posterAsset: SdkFeedAssetPayload? = null,
    val cta: SdkFeedCtaPayload? = null,
)

@Serializable
internal data class SdkFeedAssetPayload(
    val id: String,
    val url: String,
    @SerialName("mime_type")
    val mimeType: String,
    val width: Int? = null,
    val height: Int? = null,
    @SerialName("duration_ms")
    val durationMs: Long? = null,
)

@Serializable
internal data class SdkFeedCtaPayload(
    val label: String,
    val type: String,
    val value: String,
)

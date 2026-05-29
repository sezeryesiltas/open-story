package com.openstory.sdk.internal.network

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

internal object SdkFeedJsonCodec {
    fun encodeRequest(payload: SdkFeedRequestPayload): String {
        return JSONObject()
            .put("client_id", payload.clientId)
            .put("placement_key", payload.placementKey)
            .put("platform", payload.platform)
            .put("app_version", payload.appVersion)
            .put("user_segments", payload.userSegments.toJsonArray())
            .toString()
    }

    fun decodeResponse(json: String): SdkFeedResponsePayload {
        return JSONObject(json).toResponsePayload()
    }

    fun encodeResponse(payload: SdkFeedResponsePayload): String {
        return payload.toJsonObject().toString()
    }

    private fun JSONObject.toResponsePayload(): SdkFeedResponsePayload {
        return SdkFeedResponsePayload(
            clientId = requiredString("client_id"),
            placementKey = requiredString("placement_key"),
            context = requiredObject("context").toContextPayload(),
            resolvedSet = optionalObject("resolved_set")?.toSetPayload(),
            generatedAt = requiredString("generated_at"),
        )
    }

    private fun JSONObject.toContextPayload(): SdkFeedContextPayload {
        return SdkFeedContextPayload(
            platform = requiredString("platform"),
            appVersion = requiredString("app_version"),
            userSegments = requiredArray("user_segments").toStringList(),
        )
    }

    private fun JSONObject.toSetPayload(): SdkFeedSetPayload {
        return SdkFeedSetPayload(
            id = requiredString("id"),
            revisionId = requiredString("revision_id"),
            placementKey = requiredString("placement_key"),
            isFallback = requiredBoolean("is_fallback"),
            groups = requiredArray("groups").toObjectList { it.toGroupPayload() },
        )
    }

    private fun JSONObject.toGroupPayload(): SdkFeedGroupPayload {
        return SdkFeedGroupPayload(
            id = requiredString("id"),
            revisionId = requiredString("revision_id"),
            title = requiredString("title"),
            bottomLabel = optionalString("bottom_label"),
            logoUrl = requiredString("logo_url"),
            badge = optionalObject("badge")?.toBadgePayload(),
            stories = requiredArray("stories").toObjectList { it.toStoryPayload() },
        )
    }

    private fun JSONObject.toBadgePayload(): SdkFeedBadgePayload {
        return SdkFeedBadgePayload(
            type = requiredString("type"),
            value = requiredString("value"),
        )
    }

    private fun JSONObject.toStoryPayload(): SdkFeedStoryPayload {
        return SdkFeedStoryPayload(
            id = requiredString("id"),
            revisionId = requiredString("revision_id"),
            title = requiredString("title"),
            mediaType = requiredString("media_type"),
            imageDurationMs = optionalLong("image_duration_ms"),
            asset = requiredObject("asset").toAssetPayload(),
            posterAsset = optionalObject("poster_asset")?.toAssetPayload(),
            cta = optionalObject("cta")?.toCtaPayload(),
        )
    }

    private fun JSONObject.toAssetPayload(): SdkFeedAssetPayload {
        return SdkFeedAssetPayload(
            id = requiredString("id"),
            url = requiredString("url"),
            mimeType = requiredString("mime_type"),
            width = optionalInt("width"),
            height = optionalInt("height"),
            durationMs = optionalLong("duration_ms"),
        )
    }

    private fun JSONObject.toCtaPayload(): SdkFeedCtaPayload {
        return SdkFeedCtaPayload(
            label = requiredString("label"),
            type = requiredString("type"),
            value = requiredString("value"),
        )
    }

    private fun SdkFeedResponsePayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("client_id", clientId)
            .put("placement_key", placementKey)
            .put("context", context.toJsonObject())
            .putOptional("resolved_set", resolvedSet?.toJsonObject())
            .put("generated_at", generatedAt)
    }

    private fun SdkFeedContextPayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("platform", platform)
            .put("app_version", appVersion)
            .put("user_segments", userSegments.toJsonArray())
    }

    private fun SdkFeedSetPayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("id", id)
            .put("revision_id", revisionId)
            .put("placement_key", placementKey)
            .put("is_fallback", isFallback)
            .put("groups", groups.map { it.toJsonObject() }.toJsonArray())
    }

    private fun SdkFeedGroupPayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("id", id)
            .put("revision_id", revisionId)
            .put("title", title)
            .putOptional("bottom_label", bottomLabel)
            .put("logo_url", logoUrl)
            .putOptional("badge", badge?.toJsonObject())
            .put("stories", stories.map { it.toJsonObject() }.toJsonArray())
    }

    private fun SdkFeedBadgePayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("type", type)
            .put("value", value)
    }

    private fun SdkFeedStoryPayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("id", id)
            .put("revision_id", revisionId)
            .put("title", title)
            .put("media_type", mediaType)
            .putOptional("image_duration_ms", imageDurationMs)
            .put("asset", asset.toJsonObject())
            .putOptional("poster_asset", posterAsset?.toJsonObject())
            .putOptional("cta", cta?.toJsonObject())
    }

    private fun SdkFeedAssetPayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("id", id)
            .put("url", url)
            .put("mime_type", mimeType)
            .putOptional("width", width)
            .putOptional("height", height)
            .putOptional("duration_ms", durationMs)
    }

    private fun SdkFeedCtaPayload.toJsonObject(): JSONObject {
        return JSONObject()
            .put("label", label)
            .put("type", type)
            .put("value", value)
    }

    private fun Collection<*>.toJsonArray(): JSONArray {
        val array = JSONArray()
        forEach { value -> array.put(value) }
        return array
    }

    private fun JSONArray.toStringList(): List<String> {
        return List(length()) { index -> getString(index) }
    }

    private fun <T> JSONArray.toObjectList(transform: (JSONObject) -> T): List<T> {
        return List(length()) { index -> transform(getJSONObject(index)) }
    }

    private fun JSONObject.putOptional(name: String, value: Any?): JSONObject {
        if (value != null) {
            put(name, value)
        }
        return this
    }

    private fun JSONObject.requiredString(name: String): String {
        return required(name) { getString(name) }
    }

    private fun JSONObject.optionalString(name: String): String? {
        return optional(name) { getString(name) }
    }

    private fun JSONObject.requiredBoolean(name: String): Boolean {
        return required(name) { getBoolean(name) }
    }

    private fun JSONObject.optionalInt(name: String): Int? {
        return optional(name) { getInt(name) }
    }

    private fun JSONObject.optionalLong(name: String): Long? {
        return optional(name) { getLong(name) }
    }

    private fun JSONObject.requiredObject(name: String): JSONObject {
        return required(name) { getJSONObject(name) }
    }

    private fun JSONObject.optionalObject(name: String): JSONObject? {
        return optional(name) { getJSONObject(name) }
    }

    private fun JSONObject.requiredArray(name: String): JSONArray {
        return required(name) { getJSONArray(name) }
    }

    private inline fun <T> JSONObject.required(name: String, read: JSONObject.() -> T): T {
        if (!has(name) || isNull(name)) {
            throw JSONException("Missing required feed field: $name")
        }
        return read()
    }

    private inline fun <T> JSONObject.optional(name: String, read: JSONObject.() -> T): T? {
        return if (has(name) && !isNull(name)) read() else null
    }
}

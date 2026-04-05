package com.openstory.sdk.internal.network

import com.openstory.sdk.OpenStoryConfiguration
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

internal class OpenStoryApi(
    configuration: OpenStoryConfiguration,
    private val json: Json,
) {
    private val baseUrl = configuration.normalizedBaseUrl()

    private val client = OkHttpClient.Builder()
        .connectTimeout(configuration.connectTimeoutMillis, TimeUnit.MILLISECONDS)
        .readTimeout(configuration.readTimeoutMillis, TimeUnit.MILLISECONDS)
        .build()

    suspend fun fetchFeed(
        requestPayload: SdkFeedRequestPayload,
        staticToken: String,
    ): SdkFeedResponsePayload = withContext(Dispatchers.IO) {
        val body = json.encodeToString(requestPayload)
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("$baseUrl/v1/sdk/feed")
            .post(body)
            .header("Authorization", "Bearer $staticToken")
            .build()

        client.newCall(request).execute().use { response ->
            when {
                response.code == 401 || response.code == 403 -> {
                    throw OpenStoryAuthorizationException(response.code)
                }

                !response.isSuccessful -> {
                    throw IOException("Story feed request failed with HTTP ${response.code}.")
                }
            }

            val responseBody = response.body?.string()
                ?: throw IOException("Story feed response body is empty.")

            SdkFeedResponseNormalizer.normalizeLoopbackUrls(
                response = json.decodeFromString<SdkFeedResponsePayload>(responseBody),
                baseUrl = baseUrl,
            )
        }
    }
}

internal class OpenStoryAuthorizationException(
    val statusCode: Int,
) : IOException("Story feed authorization failed with HTTP $statusCode.")

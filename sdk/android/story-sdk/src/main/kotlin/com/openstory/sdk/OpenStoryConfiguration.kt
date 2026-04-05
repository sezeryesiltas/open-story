package com.openstory.sdk

data class OpenStoryConfiguration(
    val clientId: String,
    val staticToken: String,
    val baseUrl: String,
    val connectTimeoutMillis: Long = 5_000L,
    val readTimeoutMillis: Long = 10_000L,
) {
    init {
        require(clientId.isNotBlank()) { "clientId must not be blank." }
        require(staticToken.isNotBlank()) { "staticToken must not be blank." }
        require(baseUrl.isNotBlank()) { "baseUrl must not be blank." }
        require(connectTimeoutMillis > 0) { "connectTimeoutMillis must be positive." }
        require(readTimeoutMillis > 0) { "readTimeoutMillis must be positive." }
    }

    internal fun normalizedBaseUrl(): String = baseUrl.trim().trimEnd('/')
}

package com.openstory.sdk.internal.ui

import com.openstory.sdk.internal.network.SdkFeedStoryPayload

internal val SdkFeedStoryPayload.viewerBackdropImageUrl: String?
    get() = if (mediaType == "video") {
        posterAsset?.url ?: asset.url
    } else {
        null
    }

package com.openstory.sdk

import com.openstory.sdk.model.OpenStoryAnalyticsEvent
import com.openstory.sdk.model.OpenStoryCtaPayload

interface OpenStoryCallbacks {
    fun onStoryBarImpression(event: OpenStoryAnalyticsEvent) = Unit

    fun onStoryGroupTap(event: OpenStoryAnalyticsEvent) = Unit

    fun onStoryView(event: OpenStoryAnalyticsEvent) = Unit

    fun onStoryComplete(event: OpenStoryAnalyticsEvent) = Unit

    fun onStoryCtaTap(payload: OpenStoryCtaPayload) = Unit

    fun onViewerClose(event: OpenStoryAnalyticsEvent) = Unit

    fun onGroupComplete(event: OpenStoryAnalyticsEvent) = Unit

    fun onError(placementKey: String, throwable: Throwable) = Unit
}

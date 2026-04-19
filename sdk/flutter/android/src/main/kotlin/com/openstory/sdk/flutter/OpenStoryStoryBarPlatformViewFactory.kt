package com.openstory.sdk.flutter

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.StandardMessageCodec
import io.flutter.plugin.platform.PlatformView
import io.flutter.plugin.platform.PlatformViewFactory

internal class OpenStoryStoryBarPlatformViewFactory(
    private val messenger: BinaryMessenger,
) : PlatformViewFactory(StandardMessageCodec.INSTANCE) {
    override fun create(
        context: Context,
        viewId: Int,
        args: Any?,
    ): PlatformView {
        val creationParams = args as? Map<*, *> ?: emptyMap<Any?, Any?>()
        return OpenStoryStoryBarPlatformView(
            context = context,
            messenger = messenger,
            creationParams = creationParams,
        )
    }
}

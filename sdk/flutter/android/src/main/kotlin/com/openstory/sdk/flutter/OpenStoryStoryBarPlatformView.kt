package com.openstory.sdk.flutter

import android.content.Context
import android.graphics.Color
import android.view.View
import android.widget.FrameLayout
import com.openstory.sdk.OpenStory
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.platform.PlatformView

internal class OpenStoryStoryBarPlatformView(
    context: Context,
    messenger: BinaryMessenger,
    creationParams: Map<*, *>,
) : PlatformView {
    private val container = FrameLayout(context).apply {
        clipChildren = true
        clipToPadding = true
    }
    private val eventStreamHandler = BufferedEventStreamHandler()
    private val eventChannel: EventChannel

    init {
        val callbackChannel = creationParams.requireString("callbackChannel")
        eventChannel = EventChannel(messenger, callbackChannel)
        eventChannel.setStreamHandler(eventStreamHandler)

        val placementKey = creationParams.requireString("placementKey")
        val titleColor = creationParams.readColor("titleColorValue") ?: DEFAULT_TITLE_COLOR
        val viewedTitleColor = creationParams.readColor("viewedTitleColorValue")
            ?: DEFAULT_VIEWED_TITLE_COLOR

        OpenStory.renderStoryBar(
            placementKey = placementKey,
            container = container,
            callbacks = OpenStoryFlutterCallbacks(eventStreamHandler),
            textColor = titleColor,
            viewedTextColor = viewedTitleColor,
        )
    }

    override fun getView(): View = container

    override fun dispose() {
        container.removeAllViews()
        eventChannel.setStreamHandler(null)
        eventStreamHandler.close()
    }

    private companion object {
        val DEFAULT_TITLE_COLOR: Int = Color.parseColor("#2B1A12")
        val DEFAULT_VIEWED_TITLE_COLOR: Int = Color.parseColor("#8E8176")
    }
}

private fun Map<*, *>.readColor(key: String): Int? {
    val value = this[key] as? Number ?: return null
    return value.toLong().toInt()
}

internal class BufferedEventStreamHandler : EventChannel.StreamHandler {
    private var sink: EventChannel.EventSink? = null
    private val bufferedEvents = mutableListOf<Any?>()
    private var closed = false

    @Synchronized
    override fun onListen(
        arguments: Any?,
        events: EventChannel.EventSink,
    ) {
        sink = events
        val pendingEvents = bufferedEvents.toList()
        bufferedEvents.clear()
        pendingEvents.forEach(events::success)
    }

    @Synchronized
    override fun onCancel(arguments: Any?) {
        sink = null
    }

    @Synchronized
    fun send(event: Map<String, Any?>) {
        if (closed) {
            return
        }

        val activeSink = sink
        if (activeSink != null) {
            activeSink.success(event)
            return
        }

        bufferedEvents += event
    }

    @Synchronized
    fun close() {
        closed = true
        sink = null
        bufferedEvents.clear()
    }
}

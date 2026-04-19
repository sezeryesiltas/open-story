package com.openstory.sdk.flutter

import android.content.Context
import com.openstory.sdk.OpenStory
import com.openstory.sdk.OpenStoryConfiguration
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class OpenStoryFlutterPlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
    private lateinit var applicationContext: Context
    private lateinit var methodChannel: MethodChannel

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        applicationContext = binding.applicationContext
        methodChannel = MethodChannel(binding.binaryMessenger, METHOD_CHANNEL_NAME)
        methodChannel.setMethodCallHandler(this)
        binding.platformViewRegistry.registerViewFactory(
            VIEW_TYPE_NAME,
            OpenStoryStoryBarPlatformViewFactory(binding.binaryMessenger),
        )
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        methodChannel.setMethodCallHandler(null)
    }

    override fun onMethodCall(
        call: MethodCall,
        result: MethodChannel.Result,
    ) {
        try {
            when (call.method) {
                "initialize" -> {
                    val arguments = call.argumentsAsMap()
                    val clientId = arguments.requireString("clientId")
                    val staticToken = arguments.requireString("staticToken")
                    val baseUrl = arguments.requireString("baseUrl")
                    val connectTimeoutMillis = arguments.requireLong("connectTimeoutMillis")
                    val readTimeoutMillis = arguments.requireLong("readTimeoutMillis")

                    OpenStory.initialize(
                        context = applicationContext,
                        configuration = OpenStoryConfiguration(
                            clientId = clientId,
                            staticToken = staticToken,
                            baseUrl = baseUrl,
                            connectTimeoutMillis = connectTimeoutMillis,
                            readTimeoutMillis = readTimeoutMillis,
                        ),
                    )
                    result.success(null)
                }

                "setUserContext" -> {
                    val arguments = call.argumentsAsMap()
                    OpenStory.setUserContext(arguments.requireStringList("userSegments"))
                    result.success(null)
                }

                "reload" -> {
                    val arguments = call.argumentsAsMap()
                    OpenStory.reload(arguments.requireString("placementKey"))
                    result.success(null)
                }

                else -> result.notImplemented()
            }
        } catch (throwable: Throwable) {
            result.error(
                "open_story_invalid_arguments",
                throwable.message ?: "OpenStory Flutter received invalid arguments.",
                null,
            )
        }
    }

    companion object {
        internal const val METHOD_CHANNEL_NAME = "open_story_flutter/methods"
        internal const val VIEW_TYPE_NAME = "open_story_flutter/story_bar"
    }
}

internal fun MethodCall.argumentsAsMap(): Map<*, *> {
    return arguments as? Map<*, *>
        ?: throw IllegalArgumentException("Method arguments must be a map.")
}

internal fun Map<*, *>.requireString(key: String): String {
    val value = this[key] as? String
        ?: throw IllegalArgumentException("$key must be a string.")
    if (value.trim().isEmpty()) {
        throw IllegalArgumentException("$key must not be blank.")
    }
    return value
}

internal fun Map<*, *>.requireLong(key: String): Long {
    val value = this[key] as? Number
        ?: throw IllegalArgumentException("$key must be a number.")
    val convertedValue = value.toLong()
    if (convertedValue <= 0L) {
        throw IllegalArgumentException("$key must be positive.")
    }
    return convertedValue
}

internal fun Map<*, *>.requireStringList(key: String): List<String> {
    val value = this[key] as? List<*>
        ?: throw IllegalArgumentException("$key must be a list of strings.")

    return value.mapIndexed { index, item ->
        val stringValue = item as? String
            ?: throw IllegalArgumentException("$key[$index] must be a string.")
        stringValue
    }
}

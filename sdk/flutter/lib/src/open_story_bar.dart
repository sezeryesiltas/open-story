import "dart:async";

import "package:flutter/foundation.dart";
import "package:flutter/services.dart";
import "package:flutter/widgets.dart";

import "internal/channel_payload.dart";
import "models/open_story_analytics_event.dart";
import "models/open_story_cta_payload.dart";
import "models/open_story_platform_error.dart";

typedef OpenStoryAnalyticsEventHandler =
    void Function(OpenStoryAnalyticsEvent event);
typedef OpenStoryCtaPayloadHandler = void Function(OpenStoryCtaPayload payload);
typedef OpenStoryErrorHandler =
    void Function(OpenStoryPlatformError error);

class OpenStoryBar extends StatefulWidget {
  const OpenStoryBar({
    super.key,
    required this.placementKey,
    this.height = 106,
    this.titleColor,
    this.viewedTitleColor,
    this.onStoryBarImpression,
    this.onStoryGroupTap,
    this.onStoryView,
    this.onStoryComplete,
    this.onStoryCtaTap,
    this.onViewerClose,
    this.onGroupComplete,
    this.onError,
  }) : assert(height > 0);

  final String placementKey;
  final double height;
  final Color? titleColor;
  final Color? viewedTitleColor;
  final OpenStoryAnalyticsEventHandler? onStoryBarImpression;
  final OpenStoryAnalyticsEventHandler? onStoryGroupTap;
  final OpenStoryAnalyticsEventHandler? onStoryView;
  final OpenStoryAnalyticsEventHandler? onStoryComplete;
  final OpenStoryCtaPayloadHandler? onStoryCtaTap;
  final OpenStoryAnalyticsEventHandler? onViewerClose;
  final OpenStoryAnalyticsEventHandler? onGroupComplete;
  final OpenStoryErrorHandler? onError;

  @override
  State<OpenStoryBar> createState() => _OpenStoryBarState();
}

class _OpenStoryBarState extends State<OpenStoryBar> {
  static int _nextCallbackId = 0;
  static const String _viewType = "open_story_flutter/story_bar";

  late final String _callbackChannelName;
  late final EventChannel _eventChannel;
  StreamSubscription<dynamic>? _eventSubscription;

  @override
  void initState() {
    super.initState();
    _callbackChannelName = "open_story_flutter/events/${_nextCallbackId++}";
    _eventChannel = EventChannel(_callbackChannelName);
    _eventSubscription = _eventChannel.receiveBroadcastStream().listen(
      _handlePlatformEvent,
      onError: _handleStreamError,
    );
  }

  @override
  void dispose() {
    _eventSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      throw UnsupportedError("OpenStoryBar supports only Android and iOS.");
    }

    final Widget platformView = switch (defaultTargetPlatform) {
      TargetPlatform.android => AndroidView(
        key: ValueKey<String>(_platformViewKey),
        viewType: _viewType,
        creationParams: _creationParams,
        creationParamsCodec: const StandardMessageCodec(),
        hitTestBehavior: PlatformViewHitTestBehavior.opaque,
      ),
      TargetPlatform.iOS => UiKitView(
        key: ValueKey<String>(_platformViewKey),
        viewType: _viewType,
        creationParams: _creationParams,
        creationParamsCodec: const StandardMessageCodec(),
        hitTestBehavior: PlatformViewHitTestBehavior.opaque,
      ),
      _ => throw UnsupportedError(
        "OpenStoryBar supports only Android and iOS.",
      ),
    };

    return SizedBox(
      height: widget.height,
      child: platformView,
    );
  }

  Map<String, Object?> get _creationParams {
    return <String, Object?>{
      "placementKey": widget.placementKey,
      "callbackChannel": _callbackChannelName,
      "titleColorValue": widget.titleColor?.value,
      "viewedTitleColorValue": widget.viewedTitleColor?.value,
    };
  }

  String get _platformViewKey {
    return [
      widget.placementKey,
      widget.titleColor?.value.toString() ?? "default-title",
      widget.viewedTitleColor?.value.toString() ?? "default-viewed-title",
    ].join("|");
  }

  void _handlePlatformEvent(dynamic rawEvent) {
    try {
      final Map<String, Object?> payload = readOpenStoryMap(rawEvent);
      final String type = readRequiredString(payload, "type");

      switch (type) {
        case "analytics":
          _dispatchAnalyticsEvent(OpenStoryAnalyticsEvent.fromMap(payload));
          return;
        case "cta":
          widget.onStoryCtaTap?.call(OpenStoryCtaPayload.fromMap(payload));
          return;
        case "error":
          widget.onError?.call(OpenStoryPlatformError.fromMap(payload));
          return;
        default:
          throw FormatException("Unsupported OpenStory callback type: $type");
      }
    } catch (error) {
      widget.onError?.call(
        OpenStoryPlatformError(
          placementKey: widget.placementKey,
          message: "Failed to decode an OpenStory callback: $error",
          errorType: error.runtimeType.toString(),
        ),
      );
    }
  }

  void _handleStreamError(Object error) {
    if (widget.onError == null) {
      return;
    }

    if (error is PlatformException) {
      widget.onError!(
        OpenStoryPlatformError(
          placementKey: widget.placementKey,
          message: error.message ?? error.code,
          code: error.code,
          errorType: "PlatformException",
        ),
      );
      return;
    }

    widget.onError!(
      OpenStoryPlatformError(
        placementKey: widget.placementKey,
        message: error.toString(),
        errorType: error.runtimeType.toString(),
      ),
    );
  }

  void _dispatchAnalyticsEvent(OpenStoryAnalyticsEvent event) {
    switch (event.kind) {
      case OpenStoryAnalyticsEventKind.storyBarImpression:
        widget.onStoryBarImpression?.call(event);
        return;
      case OpenStoryAnalyticsEventKind.storyGroupTap:
        widget.onStoryGroupTap?.call(event);
        return;
      case OpenStoryAnalyticsEventKind.storyView:
        widget.onStoryView?.call(event);
        return;
      case OpenStoryAnalyticsEventKind.storyComplete:
        widget.onStoryComplete?.call(event);
        return;
      case OpenStoryAnalyticsEventKind.storyCtaTap:
        return;
      case OpenStoryAnalyticsEventKind.viewerClose:
        widget.onViewerClose?.call(event);
        return;
      case OpenStoryAnalyticsEventKind.groupComplete:
        widget.onGroupComplete?.call(event);
        return;
    }
  }
}

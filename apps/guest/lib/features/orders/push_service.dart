import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/router.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // FCM displays notification payloads automatically when backgrounded.
}

class GuestPushService {
  GuestPushService._();
  static final instance = GuestPushService._();

  static const _ordersChannelId = 'orders';
  static const _marketingChannelId = 'marketing';

  final _local = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  Future<void> init(WidgetRef ref) async {
    if (_ready) return;
    try {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      await _local.initialize(
        const InitializationSettings(android: androidInit),
        onDidReceiveNotificationResponse: (response) {
          final payload = response.payload;
          if (payload != null && payload.isNotEmpty) {
            _openFromPayload(payload);
          }
        },
      );

      final androidPlugin = _local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          _ordersChannelId,
          'Order updates',
          description: 'Order, payment, and delivery updates',
          importance: Importance.high,
        ),
      );
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          _marketingChannelId,
          'Offers & news',
          description: 'Promotions and Cullinos news',
          importance: Importance.defaultImportance,
        ),
      );

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();

      await _registerTokenIfAuthed(ref);

      messaging.onTokenRefresh.listen((token) async {
        final auth = ref.read(authControllerProvider);
        if (auth.isAuthenticated) {
          try {
            await ref.read(guestApiProvider).registerDevice(token);
          } catch (_) {}
        }
      });

      FirebaseMessaging.onMessage.listen((msg) async {
        await _showForeground(msg);
      });

      FirebaseMessaging.onMessageOpenedApp.listen(_handleRemoteMessage);

      final initial = await messaging.getInitialMessage();
      if (initial != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _handleRemoteMessage(initial);
        });
      }

      _ready = true;
    } catch (_) {
      // Firebase optional in local/dev without google-services.json
    }
  }

  /// Call after login / session restore so the device is registered.
  Future<void> registerForCurrentUser(WidgetRef ref) async {
    await _registerTokenIfAuthed(ref);
  }

  Future<void> registerForAuth(AuthState auth, GuestApi api) async {
    if (!auth.isAuthenticated) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await api.registerDevice(token);
      }
    } catch (_) {}
  }

  Future<void> _registerTokenIfAuthed(WidgetRef ref) async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isAuthenticated) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await ref.read(guestApiProvider).registerDevice(token);
      }
    } catch (_) {}
  }

  Future<void> _showForeground(RemoteMessage msg) async {
    final n = msg.notification;
    final title = n?.title ?? msg.data['title']?.toString() ?? 'Cullinos';
    final body = n?.body ?? msg.data['body']?.toString() ?? '';
    final type = (msg.data['type'] ?? '').toString();
    final isMarketing = type.startsWith('marketing');
    final channelId = isMarketing ? _marketingChannelId : _ordersChannelId;
    final channelName = isMarketing ? 'Offers & news' : 'Order updates';

    final payload = jsonEncode({
      'orderId': msg.data['orderId']?.toString(),
      'deepLink': msg.data['deepLink']?.toString(),
      'type': type,
    });

    await _local.show(
      title.hashCode ^ body.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          channelDescription: isMarketing
              ? 'Promotions and Cullinos news'
              : 'Order, payment, and delivery updates',
          importance:
              isMarketing ? Importance.defaultImportance : Importance.high,
          priority: isMarketing ? Priority.defaultPriority : Priority.high,
          styleInformation: BigTextStyleInformation(
            body.isNotEmpty ? body : title,
            contentTitle: title,
            summaryText: 'Cullinos',
          ),
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: payload,
    );
  }

  void _handleRemoteMessage(RemoteMessage msg) {
    final orderId = msg.data['orderId']?.toString();
    final deepLink = msg.data['deepLink']?.toString();
    _openTargets(orderId: orderId, deepLink: deepLink);
  }

  void _openFromPayload(String payload) {
    try {
      final map = jsonDecode(payload);
      if (map is Map) {
        _openTargets(
          orderId: map['orderId']?.toString(),
          deepLink: map['deepLink']?.toString(),
        );
        return;
      }
    } catch (_) {
      // Legacy: bare orderId string
    }
    if (payload.isNotEmpty && !payload.startsWith('{')) {
      _openOrder(payload);
    }
  }

  void _openTargets({String? orderId, String? deepLink}) {
    if (orderId != null && orderId.isNotEmpty) {
      _openOrder(orderId);
      return;
    }
    if (deepLink != null && deepLink.isNotEmpty) {
      openDeepLink(deepLink);
    }
  }

  void _openOrder(String orderId) {
    final ctx = guestRootNavigatorKey.currentContext;
    if (ctx == null) return;
    GoRouter.of(ctx).push('/orders/$orderId');
  }

  /// Open an in-app path or guest.cullinos.com storefront link.
  static void openDeepLink(String deepLink) {
    final ctx = guestRootNavigatorKey.currentContext;
    if (ctx == null) return;
    final router = GoRouter.of(ctx);
    final uri = Uri.tryParse(deepLink);
    if (uri == null) return;
    if (uri.hasScheme &&
        (uri.scheme == 'http' ||
            uri.scheme == 'https' ||
            uri.scheme == 'cullinos')) {
      // Prefer in-app paths; absolute https guest links → /o/...
      if (uri.host == 'guest.cullinos.com' &&
          uri.pathSegments.length >= 3 &&
          uri.pathSegments.first == 'o') {
        router.go(
          '/o/${uri.pathSegments[1]}/${uri.pathSegments[2]}${uri.hasQuery ? '?${uri.query}' : ''}',
        );
        return;
      }
      if (deepLink.startsWith('/')) {
        router.go(deepLink);
        return;
      }
    }
    if (deepLink.startsWith('/')) {
      router.go(deepLink);
    }
  }
}

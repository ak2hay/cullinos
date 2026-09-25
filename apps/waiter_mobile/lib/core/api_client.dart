import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/core/portal_status.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.current.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Cullinos-Portal': waiterPortalId,
      },
    ),
  );
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = ref.read(authControllerProvider).accessToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) {
        if (e.response?.statusCode == 401) {
          ref.read(authControllerProvider).clearUnauthorizedSession();
        }
        final block = portalBlockMessageFrom(e);
        if (block != null) {
          final portal = ref.read(portalStatusProvider);
          if (block.maintenance) {
            portal.markMaintenance(block.message);
          } else {
            portal.markDisabled(block.message);
          }
          ref.read(authControllerProvider).clearUnauthorizedSession();
        }
        handler.next(e);
      },
    ),
  );
  return dio;
});

String friendlyDioError(Object e, {String fallback = 'Request failed'}) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map) {
      final err = data['error'];
      if (err is Map) {
        final msg = err['message'];
        if (msg is String && msg.isNotEmpty) return msg;
      }
      final message = data['message'];
      if (message is String && message.isNotEmpty) return message;
      if (message is List && message.isNotEmpty) {
        return message.map((m) => m.toString()).join(', ');
      }
    }
    if (data is String && data.trim().isNotEmpty && data.length < 200) {
      return data.trim();
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Network error. Check your connection.';
    }
    final status = e.response?.statusCode;
    if (status == 401) return 'Sign in again to continue.';
    if (status == 403) return 'You do not have permission for this action.';
    if (status != null && status >= 500) {
      return 'Server error. Try again in a moment.';
    }
  }
  return fallback;
}

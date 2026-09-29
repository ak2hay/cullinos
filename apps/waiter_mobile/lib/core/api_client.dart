import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/core/portal_status.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';

const _retriedKey = 'cullinos_retried_after_refresh';

BaseOptions _baseOptions() => BaseOptions(
      baseUrl: AppConfig.current.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Cullinos-Portal': waiterPortalId,
      },
    );

/// Rotates the stored refresh token once for all concurrent 401s.
class _SessionRefresher {
  _SessionRefresher(this._ref);

  final Ref _ref;
  final Dio _plain = Dio(_baseOptions());
  Future<bool>? _inflight;

  Future<bool> refresh() => _inflight ??= _run().whenComplete(() => _inflight = null);

  Future<bool> _run() async {
    final auth = _ref.read(authControllerProvider);
    final token = auth.refreshToken;
    if (token == null || token.isEmpty) return false;
    try {
      final res = await _plain.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': token},
      );
      final body = res.data;
      final access = (body?['accessToken'] ?? body?['token'])?.toString();
      if (body == null || access == null || access.isEmpty) return false;
      final user = body['user'];
      final perms = body['permissions'];
      await auth.setSession(
        accessToken: access,
        refreshToken: body['refreshToken']?.toString(),
        userId: user is Map ? user['id']?.toString() : auth.userId,
        email: user is Map ? user['email']?.toString() : auth.email,
        name: user is Map ? user['name']?.toString() : auth.name,
        permissions: perms is List ? perms.map((p) => p.toString()).toList() : null,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

bool _isAuthEndpoint(String path) =>
    path.contains('/auth/login') ||
    path.contains('/auth/refresh') ||
    path.contains('/auth/logout');

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(_baseOptions());
  final refresher = _SessionRefresher(ref);
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = ref.read(authControllerProvider).accessToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        final options = e.requestOptions;
        if (e.response?.statusCode == 401 &&
            options.extra[_retriedKey] != true &&
            !_isAuthEndpoint(options.path) &&
            await refresher.refresh()) {
          options.extra[_retriedKey] = true;
          options.headers['Authorization'] =
              'Bearer ${ref.read(authControllerProvider).accessToken}';
          try {
            handler.resolve(await dio.fetch<dynamic>(options));
          } on DioException catch (retryError) {
            handler.next(retryError);
          }
          return;
        }
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

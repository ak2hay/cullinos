import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/config.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.current.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        // Preserve Authorization set by the caller (e.g. per-org customer JWT
        // for loyalty). Only inject the guest token when none is present.
        final existing = options.headers['Authorization']?.toString();
        if (existing == null || existing.isEmpty) {
          final token = ref.read(authControllerProvider).accessToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          final path = error.requestOptions.path;
          final isPublicAuth = path.contains('/public/guest/auth/otp') ||
              path.contains('/public/guest/auth/phone-status') ||
              path.contains('/public/guest/auth/firebase') ||
              path.contains('/public/guest/auth/pin/login');
          // Loyalty / membership 401 must not wipe guest session mid-checkout.
          final isLoyalty = path.contains('/public/loyalty/');
          final isMembership = path.contains('/public/guest/memberships');
          final isCoupon = path.contains('/public/guest/coupons');
          if (!isPublicAuth && !isLoyalty && !isMembership && !isCoupon) {
            ref.read(authControllerProvider).clearUnauthorizedSession();
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});

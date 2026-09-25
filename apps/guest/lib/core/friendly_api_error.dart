import 'package:dio/dio.dart';

String? _serverMessage(dynamic data) {
  if (data is Map) {
    final err = data['error'];
    if (err is Map) {
      final m = err['message']?.toString();
      if (m != null && m.isNotEmpty) return m;
    } else if (err is String && err.trim().isNotEmpty) {
      return err.trim();
    }
    final msg = data['message'];
    if (msg is List && msg.isNotEmpty) {
      return msg.map((m) => m.toString()).join(', ');
    }
    if (msg is String && msg.trim().isNotEmpty) return msg.trim();
  } else if (data is String && data.trim().isNotEmpty) {
    return data.trim();
  }
  return null;
}

/// User-facing message for API / Dio failures (never raw stack traces).
String friendlyApiError(
  Object e, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (e is DioException) {
    final status = e.response?.statusCode;
    var serverMsg = _serverMessage(e.response?.data);
    if (serverMsg != null &&
        (serverMsg.startsWith('{') ||
            serverMsg.toLowerCase().contains('instance of') ||
            serverMsg.toLowerCase().contains('dioexception'))) {
      serverMsg = null;
    }

    if (status == 401) {
      return 'Please sign in to continue.';
    }
    if (status == 403) {
      return serverMsg ?? 'You do not have access to this.';
    }
    if (status == 404) {
      final lower = (serverMsg ?? '').toLowerCase();
      if (lower.contains('coupon')) {
        return 'Coupon not valid for this restaurant.';
      }
      return serverMsg ?? 'Not found.';
    }
    if (status == 429) {
      return 'Too many attempts. Please wait and try again.';
    }
    if (status == 503) {
      return serverMsg ??
          'SMS could not be sent right now. Try again later or use Google / Email.';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'Connection timed out. Check your internet and try again.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach Cullinos servers. Check your internet.';
    }
    if (serverMsg != null && serverMsg.isNotEmpty) {
      return serverMsg;
    }
    return fallback;
  }
  final text = e.toString();
  if (text.toLowerCase().contains('dioexception')) {
    return fallback;
  }
  return text.length > 160 ? fallback : text;
}

/// Alias used by login screens.
String friendlyAuthError(Object e) =>
    friendlyApiError(e, fallback: 'Sign-in failed. Please try again.');

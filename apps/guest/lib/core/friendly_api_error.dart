import 'package:dio/dio.dart';

/// User-facing message for API / Dio failures (never raw stack traces).
String friendlyApiError(Object e, {String fallback = 'Something went wrong. Please try again.'}) {
  if (e is DioException) {
    final status = e.response?.statusCode;
    final data = e.response?.data;
    String? serverMsg;
    if (data is Map) {
      serverMsg = data['message']?.toString() ??
          data['error']?.toString() ??
          (data['errors'] is List && (data['errors'] as List).isNotEmpty
              ? (data['errors'] as List).first.toString()
              : null);
    } else if (data is String && data.trim().isNotEmpty) {
      serverMsg = data.trim();
    }

    if (status == 401) {
      return 'Please sign in to continue.';
    }
    if (status == 403) {
      return 'You do not have access to this.';
    }
    if (status == 404) {
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
    if (serverMsg != null &&
        serverMsg.isNotEmpty &&
        !serverMsg.toLowerCase().contains('dioexception')) {
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

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Value sent as `X-Cullinos-Portal` so super admin can switch the waiter app off.
const waiterPortalId = 'waiter';

/// Tracks whether super admin has switched the waiter app off platform-wide.
class PortalStatus extends ChangeNotifier {
  /// Server-provided message while the portal is off; null when the app may be used.
  String? disabledMessage;
  bool checking = false;

  bool get disabled => disabledMessage != null;

  void markDisabled(String message) {
    if (disabledMessage == message) return;
    disabledMessage = message;
    notifyListeners();
  }

  /// Probe `/public/portal-status`. Network failures leave the current state untouched;
  /// the API still enforces the switch on every request.
  Future<void> check(Dio dio) async {
    checking = true;
    notifyListeners();
    try {
      final res = await dio
          .get('/public/portal-status')
          .timeout(const Duration(seconds: 6));
      final data = res.data;
      if (data is Map) {
        final portals = data['portals'];
        final waiter = portals is Map ? portals[waiterPortalId] : null;
        final enabled = waiter is Map ? waiter['enabled'] != false : true;
        final message = data['message'];
        disabledMessage = enabled ? null : (message is String ? message : '');
      }
    } catch (_) {
      // keep previous state
    } finally {
      checking = false;
      notifyListeners();
    }
  }
}

final portalStatusProvider = ChangeNotifierProvider<PortalStatus>((ref) => PortalStatus());

/// True when a Dio error is the API's "portal switched off" response.
String? portalDisabledMessageFrom(DioException e) {
  if (e.response?.statusCode != 503) return null;
  final data = e.response?.data;
  if (data is! Map) return null;
  final err = data['error'];
  if (err is! Map || err['code'] != 'PORTAL_DISABLED') return null;
  final msg = err['message'];
  return msg is String ? msg : '';
}

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Value sent as `X-Cullinos-Portal` so super admin can switch the waiter app off.
const waiterPortalId = 'waiter';

/// Tracks whether super admin has switched the waiter app off or into maintenance.
class PortalStatus extends ChangeNotifier {
  /// Server-provided message while the portal is off; null when not disabled.
  String? disabledMessage;

  /// Server-provided message while the portal is in maintenance; null when not.
  String? maintenanceMessage;

  bool checking = false;

  bool get disabled => disabledMessage != null;
  bool get inMaintenance => maintenanceMessage != null;
  bool get blocked => disabled || inMaintenance;

  void markDisabled(String message) {
    if (disabledMessage == message && maintenanceMessage == null) return;
    disabledMessage = message;
    maintenanceMessage = null;
    notifyListeners();
  }

  void markMaintenance(String message) {
    if (maintenanceMessage == message && disabledMessage == null) return;
    maintenanceMessage = message;
    disabledMessage = null;
    notifyListeners();
  }

  void clearBlocks() {
    if (disabledMessage == null && maintenanceMessage == null) return;
    disabledMessage = null;
    maintenanceMessage = null;
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
        final maint = waiter is Map ? waiter['maintenanceMessage'] : null;
        final message = data['message'];
        if (!enabled) {
          disabledMessage = message is String ? message : '';
          maintenanceMessage = null;
        } else if (maint is String && maint.isNotEmpty) {
          maintenanceMessage = maint;
          disabledMessage = null;
        } else {
          disabledMessage = null;
          maintenanceMessage = null;
        }
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
  return portalBlockMessageFrom(e)?.message;
}

/// Parses 503 portal block responses (disabled or maintenance).
({bool maintenance, String message})? portalBlockMessageFrom(DioException e) {
  if (e.response?.statusCode != 503) return null;
  final data = e.response?.data;
  if (data is! Map) return null;
  final err = data['error'];
  if (err is! Map) return null;
  final code = err['code'];
  if (code != 'PORTAL_DISABLED' && code != 'PORTAL_MAINTENANCE') return null;
  final msg = err['message'];
  return (
    maintenance: code == 'PORTAL_MAINTENANCE',
    message: msg is String ? msg : '',
  );
}

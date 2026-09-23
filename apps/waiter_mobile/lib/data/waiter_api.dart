import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/api_client.dart';

class WaiterApi {
  WaiterApi(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> login(
    String email,
    String password, {
    String? captchaToken,
  }) async {
    final res = await _dio.post('/auth/login', data: {
      'email': email.trim(),
      'password': password,
      if (captchaToken != null && captchaToken.isNotEmpty)
        'captchaToken': captchaToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> requestPhoneOtp(
    String phone, {
    String? captchaToken,
  }) async {
    final res = await _dio.post('/auth/phone/otp/request', data: {
      'phone': phone.trim(),
      if (captchaToken != null && captchaToken.isNotEmpty)
        'captchaToken': captchaToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> verifyPhoneOtp({
    required String challengeToken,
    required String otp,
  }) async {
    final res = await _dio.post('/auth/phone/otp/verify', data: {
      'challengeToken': challengeToken,
      'otp': otp.trim(),
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String challengeToken,
    required String otp,
  }) async {
    final res = await _dio.post('/auth/verify-otp', data: {
      'challengeToken': challengeToken,
      'otp': otp,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> resendOtp(String challengeToken) async {
    final res = await _dio.post('/auth/resend-otp', data: {
      'challengeToken': challengeToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> outlets() async {
    final res = await _dio.get('/outlets');
    return List<dynamic>.from(res.data as List);
  }

  Future<List<dynamic>> tables(String outletId) async {
    final res = await _dio.get('/tables/outlets/$outletId');
    return List<dynamic>.from(res.data as List);
  }

  Future<Map<String, dynamic>> updateTableStatus(
    String outletId,
    String tableId,
    String status,
  ) async {
    final res = await _dio.patch(
      '/tables/outlets/$outletId/$tableId/status',
      data: {'status': status},
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> startSession(
    String outletId,
    String tableId, {
    int? guestCount,
  }) async {
    final res = await _dio.post(
      '/tables/outlets/$outletId/$tableId/sessions',
      data: {if (guestCount != null) 'guestCount': guestCount},
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>?> activeSession(
    String outletId,
    String tableId,
  ) async {
    final res =
        await _dio.get('/tables/outlets/$outletId/$tableId/sessions/active');
    if (res.data == null || res.data is! Map) return null;
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> closeSession(
    String outletId,
    String tableId,
    String sessionId,
  ) async {
    await _dio.post(
      '/tables/outlets/$outletId/$tableId/sessions/$sessionId/close',
    );
  }

  Future<List<dynamic>> serviceRequests(
    String outletId, {
    String status = 'open,acknowledged',
  }) async {
    final res = await _dio.get(
      '/tables/outlets/$outletId/service-requests',
      queryParameters: {'status': status},
    );
    return List<dynamic>.from(res.data as List);
  }

  Future<Map<String, dynamic>> acknowledgeCall(
    String outletId,
    String id,
  ) async {
    final res = await _dio.patch(
      '/tables/outlets/$outletId/service-requests/$id/acknowledge',
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> resolveCall(String outletId, String id) async {
    final res = await _dio
        .patch('/tables/outlets/$outletId/service-requests/$id/resolve');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> transferTable(
    String outletId, {
    required String fromTableId,
    required String toTableId,
  }) async {
    await _dio.post('/tables/outlets/$outletId/transfer', data: {
      'fromTableId': fromTableId,
      'toTableId': toTableId,
    });
  }

  Future<void> mergeTables(
    String outletId, {
    required String primaryTableId,
    required List<String> otherTableIds,
  }) async {
    await _dio.post('/tables/outlets/$outletId/merge', data: {
      'primaryTableId': primaryTableId,
      'otherTableIds': otherTableIds,
    });
  }

  Future<Map<String, dynamic>> menu(String outletId) async {
    final res = await _dio.get('/menu/outlets/$outletId');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> listOrders({
    String? outletId,
    String? tableId,
    String? status,
  }) async {
    final res = await _dio.get('/orders', queryParameters: {
      if (outletId != null) 'outletId': outletId,
      if (tableId != null) 'tableId': tableId,
      if (status != null) 'status': status,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> getOrder(String id) async {
    final res = await _dio.get('/orders/$id');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> quickOrder({
    required String outletId,
    String? tableId,
    required List<Map<String, dynamic>> items,
    String? notes,
  }) async {
    final res = await _dio.post('/pos/quick-order', data: {
      'outletId': outletId,
      if (tableId != null) 'tableId': tableId,
      'items': items,
      if (notes != null) 'notes': notes,
      'autoConfirm': false,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> addItems(
    String orderId,
    List<Map<String, dynamic>> items,
  ) async {
    final res = await _dio.post('/orders/$orderId/items', data: {
      'items': items,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> updateItemQty(
    String orderId,
    String itemId,
    int quantity,
  ) async {
    final res = await _dio.patch('/orders/$orderId/items/$itemId', data: {
      'quantity': quantity,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> removeItem(String orderId, String itemId) async {
    final res = await _dio.post('/orders/$orderId/items/$itemId/remove');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> confirmOrder(String orderId) async {
    final res = await _dio.post('/orders/$orderId/confirm');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> updateOrderStatus(
    String orderId,
    String status,
  ) async {
    final res = await _dio.patch('/orders/$orderId/status', data: {
      'status': status,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> orderBalance(String orderId) async {
    final res = await _dio.get('/payments/orders/$orderId/balance');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> payCash({
    required String orderId,
    double? amount,
  }) async {
    final res = await _dio.post('/payments/cash', data: {
      'orderId': orderId,
      if (amount != null) 'amount': amount,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> onlineIntent({
    required String orderId,
    double? amount,
    String? provider,
  }) async {
    final res = await _dio.post('/payments/online/intent', data: {
      'orderId': orderId,
      if (amount != null) 'amount': amount,
      if (provider != null) 'provider': provider,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> onlineVerify(Map<String, dynamic> body) async {
    final res = await _dio.post('/payments/online/verify', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }
}

final waiterApiProvider = Provider<WaiterApi>((ref) {
  return WaiterApi(ref.watch(dioProvider));
});

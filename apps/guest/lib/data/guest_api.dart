import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/api_client.dart';

class GuestApi {
  GuestApi(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> requestOtp(
    String phone, {
    String? captchaToken,
  }) async {
    final res = await _dio.post('/public/guest/auth/otp/request', data: {
      'phone': phone,
      if (captchaToken != null && captchaToken.isNotEmpty)
        'captchaToken': captchaToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> msg91WidgetConfig() async {
    final res = await _dio.get('/public/guest/auth/otp/widget-config');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> widgetSendOtp(
    String phone, {
    String? captchaToken,
  }) async {
    final res = await _dio.post('/public/guest/auth/otp/widget-send', data: {
      'phone': phone,
      if (captchaToken != null && captchaToken.isNotEmpty)
        'captchaToken': captchaToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> widgetRetryOtp(String reqId) async {
    final res = await _dio.post('/public/guest/auth/otp/widget-retry', data: {
      'reqId': reqId,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> widgetConfirmOtp({
    required String reqId,
    required String otp,
    required String phone,
    String? name,
  }) async {
    final res = await _dio.post('/public/guest/auth/otp/widget-confirm', data: {
      'reqId': reqId,
      'otp': otp,
      'phone': phone,
      if (name != null) 'name': name,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> verifyMsg91Widget({
    required String accessToken,
    required String phone,
    String? identifier,
    String? name,
  }) async {
    final res = await _dio.post('/public/guest/auth/otp/widget-verify', data: {
      'accessToken': accessToken,
      'phone': phone,
      if (identifier != null) 'identifier': identifier,
      if (name != null) 'name': name,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> phoneStatus(String phone) async {
    final res = await _dio.post('/public/guest/auth/phone-status', data: {
      'phone': phone,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String challengeToken,
    required String code,
    String? name,
  }) async {
    final res = await _dio.post('/public/guest/auth/otp/verify', data: {
      'challengeToken': challengeToken,
      'code': code,
      if (name != null) 'name': name,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> exchangeFirebase({
    required String idToken,
    String? name,
    String? captchaToken,
  }) async {
    final res = await _dio.post('/public/guest/auth/firebase', data: {
      'idToken': idToken,
      if (name != null) 'name': name,
      if (captchaToken != null && captchaToken.isNotEmpty)
        'captchaToken': captchaToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> setPin({
    required String pin,
    String? name,
  }) async {
    final res = await _dio.post('/public/guest/auth/pin/set', data: {
      'pin': pin,
      if (name != null) 'name': name,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> loginWithPin({
    required String phone,
    required String pin,
    String? captchaToken,
  }) async {
    final res = await _dio.post('/public/guest/auth/pin/login', data: {
      'phone': phone,
      'pin': pin,
      if (captchaToken != null && captchaToken.isNotEmpty)
        'captchaToken': captchaToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> changePin({
    required String currentPin,
    required String newPin,
  }) async {
    final res = await _dio.post('/public/guest/auth/pin/change', data: {
      'currentPin': currentPin,
      'newPin': newPin,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> me() async {
    final res = await _dio.get('/public/guest/auth/me');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> updateMe({
    String? name,
    String? email,
  }) async {
    final res = await _dio.patch('/public/guest/auth/me', data: {
      if (name != null) 'name': name,
      if (email != null) 'email': email,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> banners({
    double? lat,
    double? lng,
    List<String>? orgIds,
  }) async {
    final res = await _dio.get('/public/marketplace/banners', queryParameters: {
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (orgIds != null && orgIds.isNotEmpty) 'orgIds': orgIds.join(','),
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> nearby({
    double? lat,
    double? lng,
    String? q,
    String? cuisine,
    String? city,
    double? radiusKm,
    bool? dineIn,
    bool? takeaway,
    bool? delivery,
    bool? veg,
    bool? offersOnly,
    bool? openNow,
  }) async {
    final res = await _dio.get('/public/marketplace/nearby', queryParameters: {
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (q != null && q.isNotEmpty) 'q': q,
      if (cuisine != null && cuisine.isNotEmpty) 'cuisine': cuisine,
      if (city != null && city.isNotEmpty) 'city': city,
      if (radiusKm != null) 'radiusKm': radiusKm,
      if (dineIn == true) 'dineIn': 'true',
      if (takeaway == true) 'takeaway': 'true',
      if (delivery == true) 'delivery': 'true',
      if (veg == true) 'veg': 'true',
      if (offersOnly == true) 'offersOnly': 'true',
      if (openNow == true) 'openNow': 'true',
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> offers({double? lat, double? lng}) async {
    final res = await _dio.get('/public/marketplace/offers', queryParameters: {
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> specials({double? lat, double? lng, int? limit}) async {
    final res = await _dio.get('/public/marketplace/specials', queryParameters: {
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (limit != null) 'limit': limit,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> outletProfile(
    String orgSlug,
    String outletSlug,
  ) async {
    final res =
        await _dio.get('/public/marketplace/outlets/$orgSlug/$outletSlug');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> appConfig() async {
    final res = await _dio.get('/public/marketplace/app-config');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> discoverSections() async {
    final res = await _dio.get('/public/marketplace/discover-sections');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> ensureMembership(String orgId, {String? name}) async {
    final res = await _dio.post('/public/guest/memberships/$orgId/ensure', data: {
      if (name != null) 'name': name,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> memberships() async {
    final res = await _dio.get('/public/guest/memberships');
    return List<dynamic>.from(res.data as List);
  }

  Future<Map<String, dynamic>> storefront(
    String orgSlug,
    String outletSlug,
  ) async {
    final res = await _dio.get('/storefront/$orgSlug/$outletSlug');
    return Map<String, dynamic>.from(res.data as Map);
  }


  Future<Map<String, dynamic>> sessionAddItems(
    String sessionToken, {
    required List<Map<String, dynamic>> items,
    String? customerName,
    String? notes,
  }) async {
    final res = await _dio.post(
      '/public/sessions/$sessionToken/items',
      data: {
        'items': items,
        if (customerName != null) 'customerName': customerName,
        if (notes != null) 'notes': notes,
      },
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  /// Permanent table sticker → join or create dining session.
  Future<Map<String, dynamic>> joinTableByQr(String qrCode) async {
    final res = await _dio.get(
      '/public/tables/by-qr/${Uri.encodeComponent(qrCode)}',
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> sessionSubmit(String sessionToken) async {
    final res = await _dio.post('/public/sessions/$sessionToken/submit');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> body) async {
    final res = await _dio.post('/public/orders', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> deliveryQuote(Map<String, dynamic> body) async {
    final res = await _dio.post('/public/delivery/quote', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> orders() async {
    final res = await _dio.get('/public/guest/orders');
    return List<dynamic>.from(res.data as List);
  }

  Future<Map<String, dynamic>> order(String id) async {
    final res = await _dio.get('/public/guest/orders/$id');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> reorderPreview(String orderId) async {
    final res = await _dio.post('/public/guest/orders/$orderId/reorder-preview');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> paymentIntent(
    String orderId, {
    String? preferredMethod,
  }) async {
    final res = await _dio.post('/public/guest/payments/intent', data: {
      'orderId': orderId,
      if (preferredMethod != null) 'preferredMethod': preferredMethod,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> paymentVerify(Map<String, dynamic> body) async {
    final res = await _dio.post('/public/guest/payments/verify', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> validateCoupon({
    required String orgId,
    required String code,
    required double orderTotal,
  }) async {
    final res = await _dio.post('/public/guest/coupons/validate', data: {
      'orgId': orgId,
      'code': code,
      'orderTotal': orderTotal,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> registerDevice(String fcmToken, {String platform = 'android'}) async {
    await _dio.post('/public/guest/devices', data: {
      'fcmToken': fcmToken,
      'platform': platform,
    });
  }

  Future<List<dynamic>> addresses() async {
    final res = await _dio.get('/public/guest/addresses');
    return List<dynamic>.from(res.data as List);
  }

  Future<Map<String, dynamic>> createAddress(Map<String, dynamic> body) async {
    final res = await _dio.post('/public/guest/addresses', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> updateAddress(
    String id,
    Map<String, dynamic> body,
  ) async {
    final res = await _dio.patch('/public/guest/addresses/$id', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> deleteAddress(String id) async {
    await _dio.delete('/public/guest/addresses/$id');
  }

  Future<List<dynamic>> favoriteOutlets() async {
    final res = await _dio.get('/public/guest/favorites/outlets');
    return List<dynamic>.from(res.data as List);
  }

  Future<void> addFavoriteOutlet(String outletId) async {
    await _dio.post('/public/guest/favorites/outlets', data: {
      'outletId': outletId,
    });
  }

  Future<void> removeFavoriteOutlet(String outletId) async {
    await _dio.delete('/public/guest/favorites/outlets/$outletId');
  }

  Future<List<dynamic>> favoriteItems() async {
    final res = await _dio.get('/public/guest/favorites/items');
    return List<dynamic>.from(res.data as List);
  }

  Future<void> addFavoriteItem(String menuItemId, {String? organizationId}) async {
    await _dio.post('/public/guest/favorites/items', data: {
      'menuItemId': menuItemId,
      if (organizationId != null) 'organizationId': organizationId,
    });
  }

  Future<void> removeFavoriteItem(String menuItemId) async {
    await _dio.delete('/public/guest/favorites/items/$menuItemId');
  }

  Future<Map<String, dynamic>> createReview({
    required String outletId,
    required int rating,
    String? orderId,
    String? comment,
  }) async {
    final res = await _dio.post('/public/guest/reviews', data: {
      'outletId': outletId,
      'rating': rating,
      if (orderId != null) 'orderId': orderId,
      if (comment != null) 'comment': comment,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> outletReviews(String outletId) async {
    final res = await _dio.get('/public/guest/reviews/outlet/$outletId');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> notifications() async {
    final res = await _dio.get('/public/guest/notifications');
    return List<dynamic>.from(res.data as List);
  }

  Future<void> markNotificationRead(String id) async {
    await _dio.post('/public/guest/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _dio.post('/public/guest/notifications/read-all');
  }

  Future<Map<String, dynamic>> notificationPrefs() async {
    final res = await _dio.get('/public/guest/notification-preferences');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> updateNotificationPrefs({
    bool? transactionalEnabled,
    bool? marketingEnabled,
  }) async {
    final res = await _dio.patch('/public/guest/notification-preferences', data: {
      if (transactionalEnabled != null)
        'transactionalEnabled': transactionalEnabled,
      if (marketingEnabled != null) 'marketingEnabled': marketingEnabled,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> coins() async {
    final res = await _dio.get('/public/guest/coins');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> loyaltyMe(String orgId, String customerToken) async {
    final res = await _dio.get(
      '/public/loyalty/$orgId/me',
      options: Options(headers: {'Authorization': 'Bearer $customerToken'}),
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> loyaltyRewards(String orgId) async {
    final res = await _dio.get('/public/loyalty/$orgId/rewards');
    return List<dynamic>.from(res.data as List? ?? []);
  }

  Future<Map<String, dynamic>> redeemReward({
    required String orgId,
    required String customerToken,
    required String rewardId,
  }) async {
    final res = await _dio.post(
      '/public/loyalty/$orgId/redeem-reward',
      data: {'rewardId': rewardId},
      options: Options(headers: {'Authorization': 'Bearer $customerToken'}),
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> redeemPoints({
    required String orgId,
    required String customerToken,
    required int points,
  }) async {
    final res = await _dio.post(
      '/public/loyalty/$orgId/redeem',
      data: {'points': points},
      options: Options(headers: {'Authorization': 'Bearer $customerToken'}),
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> reservationInvite(String token) async {
    final res = await _dio.get('/public/reservations/invite/$token');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> reservationSlots({
    required String orgSlug,
    required String outletSlug,
    required String date,
    int partySize = 1,
  }) async {
    final res = await _dio.get('/public/reservations/slots', queryParameters: {
      'orgSlug': orgSlug,
      'outletSlug': outletSlug,
      'date': date,
      'partySize': partySize,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> bookReservation({
    String? orgSlug,
    String? outletSlug,
    String? inviteToken,
    required String customerName,
    required String customerPhone,
    String? customerEmail,
    required int partySize,
    required String reservedAt,
    String? notes,
  }) async {
    final res = await _dio.post('/public/reservations', data: {
      if (inviteToken != null) 'inviteToken': inviteToken,
      if (orgSlug != null) 'orgSlug': orgSlug,
      if (outletSlug != null) 'outletSlug': outletSlug,
      'customerName': customerName,
      'customerPhone': customerPhone,
      if (customerEmail != null && customerEmail.isNotEmpty)
        'customerEmail': customerEmail,
      'partySize': partySize,
      'reservedAt': reservedAt,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }
}

final guestApiProvider = Provider<GuestApi>((ref) {
  return GuestApi(ref.watch(dioProvider));
});

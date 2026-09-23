import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:cullinos_guest/core/firebase/firebase_auth_service.dart';

class AuthState extends ChangeNotifier {
  AuthState(this._firebaseAuth);

  final FirebaseAuthService _firebaseAuth;
  final _storage = const FlutterSecureStorage();

  String? accessToken;
  String? phone;
  String? guestId;
  String? name;
  String? email;
  bool hydrated = false;

  bool get isAuthenticated => accessToken != null && accessToken!.isNotEmpty;

  /// True when Firebase is signed in but we don't yet have a Cullinos guest JWT.
  bool get needsBackendExchange {
    if (_firebaseAuth.currentUser == null) return false;
    if (accessToken == null || accessToken!.isEmpty) return true;
    return _looksLikeFirebaseIdToken(accessToken!);
  }

  static bool _looksLikeFirebaseIdToken(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return false;
      final normalized = base64Url.normalize(parts[1]);
      final payload = utf8.decode(base64Url.decode(normalized));
      return payload.contains('securetoken.google.com') ||
          payload.contains('googleapis.com');
    } catch (_) {
      return false;
    }
  }

  Future<void> hydrate() async {
    accessToken = await _storage.read(key: 'guest_access_token');
    phone = await _storage.read(key: 'guest_phone');
    guestId = await _storage.read(key: 'guest_id');
    name = await _storage.read(key: 'guest_name');
    email = await _storage.read(key: 'guest_email');

    // Never treat a Firebase ID token as the Cullinos API session.
    if (accessToken != null && _looksLikeFirebaseIdToken(accessToken!)) {
      accessToken = null;
      await _storage.delete(key: 'guest_access_token');
    }

    final firebaseUser = _firebaseAuth.currentUser;
    if (firebaseUser != null) {
      await applyFirebaseProfile(firebaseUser);
    }

    hydrated = true;
    notifyListeners();
  }

  /// Updates display fields only — does not set [accessToken].
  Future<void> applyFirebaseProfile(User user) async {
    guestId = guestId ?? user.uid;
    phone = user.phoneNumber
            ?.replaceAll(RegExp(r'\D'), '')
            .replaceFirst(RegExp(r'^91'), '') ??
        phone;
    email = user.email ?? email;
    name = user.displayName ?? name;

    if (phone != null) await _storage.write(key: 'guest_phone', value: phone);
    if (name != null) await _storage.write(key: 'guest_name', value: name);
    if (email != null) await _storage.write(key: 'guest_email', value: email);
    notifyListeners();
  }

  /// @deprecated Prefer [applyFirebaseProfile] — kept so older call sites compile.
  Future<void> syncFromFirebaseUser(User user) => applyFirebaseProfile(user);

  Future<void> setSession({
    required String token,
    required String guestId,
    required String phone,
    String? name,
    String? email,
    bool staySignedIn = true,
  }) async {
    accessToken = token;
    this.guestId = guestId;
    this.phone = phone;
    this.name = name ?? this.name;
    if (email != null) this.email = email;

    if (staySignedIn) {
      await _storage.write(key: 'guest_access_token', value: token);
      await _storage.write(key: 'guest_id', value: guestId);
      await _storage.write(key: 'guest_phone', value: phone);
      if (name != null) await _storage.write(key: 'guest_name', value: name);
      if (email != null) await _storage.write(key: 'guest_email', value: email);
    } else {
      // Session-only: clear persisted session so the next app start requires sign-in.
      await _storage.deleteAll();
    }
    notifyListeners();
  }

  Future<void> updateProfileFields({String? name, String? email}) async {
    if (name != null) {
      this.name = name.isEmpty ? null : name;
      if (this.name == null) {
        await _storage.delete(key: 'guest_name');
      } else {
        await _storage.write(key: 'guest_name', value: this.name);
      }
    }
    if (email != null) {
      this.email = email.isEmpty ? null : email;
      if (this.email == null) {
        await _storage.delete(key: 'guest_email');
      } else {
        await _storage.write(key: 'guest_email', value: this.email);
      }
    }
    notifyListeners();
  }

  Future<void> logout() async {
    accessToken = null;
    guestId = null;
    phone = null;
    name = null;
    email = null;
    await _firebaseAuth.signOut();
    await _storage.deleteAll();
    notifyListeners();
  }

  /// Clears Cullinos JWT after API 401 without blocking UI.
  void clearUnauthorizedSession() {
    if (accessToken == null) return;
    accessToken = null;
    _storage.delete(key: 'guest_access_token');
    notifyListeners();
  }

  void refresh() => notifyListeners();

  Future<void> saveCustomerToken(String orgId, String token) async {
    await _storage.write(key: 'customer_token_$orgId', value: token);
  }

  Future<String?> customerToken(String orgId) =>
      _storage.read(key: 'customer_token_$orgId');
}

final authControllerProvider = ChangeNotifierProvider<AuthState>((ref) {
  return AuthState(ref.read(firebaseAuthServiceProvider));
});

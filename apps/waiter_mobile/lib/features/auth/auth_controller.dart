import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthState extends ChangeNotifier {
  AuthState();

  final _storage = const FlutterSecureStorage();

  String? accessToken;
  String? refreshToken;
  String? userId;
  String? email;
  String? name;
  String? selectedOutletId;
  List<String> permissions = [];
  bool hydrated = false;
  bool rememberMe = true;

  bool get isAuthenticated =>
      accessToken != null && accessToken!.isNotEmpty;

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    rememberMe = prefs.getBool('waiter_remember') ?? true;
    accessToken = await _storage.read(key: 'waiter_access');
    refreshToken = await _storage.read(key: 'waiter_refresh');
    userId = await _storage.read(key: 'waiter_user_id');
    email = await _storage.read(key: 'waiter_email');
    name = await _storage.read(key: 'waiter_name');
    selectedOutletId = prefs.getString('waiter_outlet_id');
    final perms = prefs.getStringList('waiter_permissions') ?? [];
    permissions = perms;
    hydrated = true;
    notifyListeners();
  }

  Future<void> setSession({
    required String accessToken,
    String? refreshToken,
    String? userId,
    String? email,
    String? name,
    List<String>? permissions,
    bool? remember,
  }) async {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.email = email;
    this.name = name;
    if (permissions != null) this.permissions = permissions;
    if (remember != null) {
      rememberMe = remember;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('waiter_remember', remember);
    }
    await _storage.write(key: 'waiter_access', value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: 'waiter_refresh', value: refreshToken);
    }
    if (userId != null) {
      await _storage.write(key: 'waiter_user_id', value: userId);
    }
    if (email != null) await _storage.write(key: 'waiter_email', value: email);
    if (name != null) await _storage.write(key: 'waiter_name', value: name);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('waiter_permissions', this.permissions);
    notifyListeners();
  }

  Future<void> setOutlet(String? outletId) async {
    selectedOutletId = outletId;
    final prefs = await SharedPreferences.getInstance();
    if (outletId == null) {
      await prefs.remove('waiter_outlet_id');
    } else {
      await prefs.setString('waiter_outlet_id', outletId);
    }
    notifyListeners();
  }

  Future<void> logout() async {
    accessToken = null;
    refreshToken = null;
    userId = null;
    email = null;
    name = null;
    permissions = [];
    await _storage.deleteAll();
    notifyListeners();
  }

  void clearUnauthorizedSession() {
    accessToken = null;
    refreshToken = null;
    notifyListeners();
  }
}

final authControllerProvider =
    ChangeNotifierProvider<AuthState>((ref) => AuthState());

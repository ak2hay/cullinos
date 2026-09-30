import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Light / Dark / System appearance preference, persisted on device.
class GuestThemeModeController extends ChangeNotifier {
  GuestThemeModeController([this._mode = ThemeMode.system]);

  static const _prefsKey = 'guest_theme_mode';

  ThemeMode _mode;
  ThemeMode get mode => _mode;

  /// Read before `runApp` so the first frame already uses the saved theme.
  static Future<ThemeMode> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return _decode(prefs.getString(_prefsKey));
    } catch (_) {
      return ThemeMode.system;
    }
  }

  Future<void> setMode(ThemeMode mode) async {
    if (mode == _mode) return;
    _mode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, mode.name);
  }

  static ThemeMode _decode(String? raw) {
    for (final mode in ThemeMode.values) {
      if (mode.name == raw) return mode;
    }
    return ThemeMode.system;
  }
}

final themeModeProvider = ChangeNotifierProvider<GuestThemeModeController>(
  (ref) => GuestThemeModeController(),
);

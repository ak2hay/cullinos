import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PrefsController extends ChangeNotifier {
  PrefsController({this.themeMode = ThemeMode.system});

  static const _themeModeKey = 'waiter_theme_mode';

  bool callSound = true;
  bool callHaptic = true;
  ThemeMode themeMode;

  /// Read before `runApp` so the first frame already uses the saved theme.
  static Future<ThemeMode> loadThemeMode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return _decodeThemeMode(prefs.getString(_themeModeKey));
    } catch (_) {
      return ThemeMode.system;
    }
  }

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    callSound = prefs.getBool('waiter_call_sound') ?? true;
    callHaptic = prefs.getBool('waiter_call_haptic') ?? true;
    themeMode = _decodeThemeMode(prefs.getString(_themeModeKey));
    notifyListeners();
  }

  Future<void> setCallSound(bool value) async {
    callSound = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('waiter_call_sound', value);
    notifyListeners();
  }

  Future<void> setCallHaptic(bool value) async {
    callHaptic = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('waiter_call_haptic', value);
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode value) async {
    if (value == themeMode) return;
    themeMode = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeModeKey, value.name);
  }

  static ThemeMode _decodeThemeMode(String? raw) {
    for (final mode in ThemeMode.values) {
      if (mode.name == raw) return mode;
    }
    return ThemeMode.system;
  }
}

final prefsControllerProvider =
    ChangeNotifierProvider<PrefsController>((ref) => PrefsController());

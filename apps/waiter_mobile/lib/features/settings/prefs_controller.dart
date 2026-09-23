import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PrefsController extends ChangeNotifier {
  bool callSound = true;
  bool callHaptic = true;

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    callSound = prefs.getBool('waiter_call_sound') ?? true;
    callHaptic = prefs.getBool('waiter_call_haptic') ?? true;
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
}

final prefsControllerProvider =
    ChangeNotifierProvider<PrefsController>((ref) => PrefsController());

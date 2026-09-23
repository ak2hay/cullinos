import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/features/settings/prefs_controller.dart';

class CallAlertService {
  CallAlertService(this._ref);
  final Ref _ref;
  final AudioPlayer _player = AudioPlayer();

  Future<void> notifyNewCall() async {
    final prefs = _ref.read(prefsControllerProvider);
    if (prefs.callHaptic) {
      await HapticFeedback.heavyImpact();
    }
    if (prefs.callSound) {
      try {
        await _player.stop();
        await _player.play(AssetSource('sounds/call_alert.wav'));
      } catch (_) {
        // Ignore audio failures on unsupported platforms.
      }
    }
  }

  void dispose() {
    _player.dispose();
  }
}

final callAlertServiceProvider = Provider<CallAlertService>((ref) {
  final svc = CallAlertService(ref);
  ref.onDispose(svc.dispose);
  return svc;
});

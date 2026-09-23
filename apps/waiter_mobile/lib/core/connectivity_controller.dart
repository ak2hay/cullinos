import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ConnectivityController extends ChangeNotifier {
  bool online = true;
  StreamSubscription<List<ConnectivityResult>>? _sub;

  Future<void> hydrate() async {
    final results = await Connectivity().checkConnectivity();
    _apply(results);
    _sub ??= Connectivity().onConnectivityChanged.listen(_apply);
  }

  void _apply(List<ConnectivityResult> results) {
    final next = results.any((r) => r != ConnectivityResult.none);
    if (next != online) {
      online = next;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

final connectivityControllerProvider =
    ChangeNotifierProvider<ConnectivityController>((ref) {
  final c = ConnectivityController();
  ref.onDispose(c.dispose);
  return c;
});

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/app.dart';
import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/features/settings/prefs_controller.dart';

Future<void> bootstrapWaiterApp(AppConfig config) async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.current = config;
  final themeMode = await PrefsController.loadThemeMode();
  runApp(
    ProviderScope(
      overrides: [
        prefsControllerProvider.overrideWith(
          (ref) => PrefsController(themeMode: themeMode),
        ),
      ],
      child: const CullinosWaiterApp(),
    ),
  );
}

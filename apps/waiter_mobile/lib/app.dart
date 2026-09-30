import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/router.dart';
import 'package:cullinos_waiter/core/theme.dart';
import 'package:cullinos_waiter/features/settings/locale_controller.dart';
import 'package:cullinos_waiter/features/settings/prefs_controller.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';

class CullinosWaiterApp extends ConsumerWidget {
  const CullinosWaiterApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final locale = ref.watch(localeControllerProvider).locale;
    final themeMode =
        ref.watch(prefsControllerProvider.select((p) => p.themeMode));
    return MaterialApp.router(
      title: 'Cullinos Waiter',
      theme: buildWaiterTheme(Brightness.light),
      darkTheme: buildWaiterTheme(Brightness.dark),
      themeMode: themeMode,
      themeAnimationDuration: const Duration(milliseconds: 350),
      themeAnimationCurve: Curves.easeOutCubic,
      routerConfig: router,
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      debugShowCheckedModeBanner: false,
    );
  }
}

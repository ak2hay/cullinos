import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';

ThemeData buildWaiterTheme([Brightness brightness = Brightness.light]) {
  final dark = brightness == Brightness.dark;
  final neutrals = WaiterNeutrals.of(brightness);
  final primary = dark ? WaiterColors.primaryOnDark : WaiterColors.primary;
  final onPrimary = dark ? const Color(0xFF06231D) : Colors.white;
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    scaffoldBackgroundColor: neutrals.scaffold,
  );
  final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
    bodyColor: neutrals.ink,
    displayColor: neutrals.ink,
  );
  final scheme = ColorScheme.fromSeed(
    seedColor: WaiterColors.primary,
    brightness: brightness,
    primary: primary,
    onPrimary: onPrimary,
    secondary: dark ? WaiterColors.primaryOnDark : WaiterColors.primaryBright,
    surface: neutrals.surface,
    onSurface: neutrals.ink,
    onSurfaceVariant: neutrals.muted,
    outline: neutrals.border,
    outlineVariant: neutrals.borderLight,
    error: WaiterColors.popularRed,
  );
  final overlay = dark
      ? SystemUiOverlayStyle.light.copyWith(
          statusBarColor: Colors.transparent,
          systemNavigationBarColor: neutrals.scaffold,
          systemNavigationBarIconBrightness: Brightness.light,
        )
      : SystemUiOverlayStyle.dark.copyWith(
          statusBarColor: Colors.transparent,
          systemNavigationBarColor: neutrals.scaffold,
          systemNavigationBarIconBrightness: Brightness.dark,
        );
  return base.copyWith(
    colorScheme: scheme,
    textTheme: textTheme,
    extensions: [neutrals],
    dividerColor: neutrals.border,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      },
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: neutrals.scaffold,
      foregroundColor: neutrals.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      systemOverlayStyle: overlay,
      titleTextStyle: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
    ),
    cardTheme: CardThemeData(
      color: neutrals.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusMd),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: neutrals.surface,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: neutrals.surface,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: neutrals.surfaceRaised,
      surfaceTintColor: Colors.transparent,
    ),
    listTileTheme: ListTileThemeData(
      iconColor: neutrals.muted,
      textColor: neutrals.ink,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: dark ? neutrals.surfaceRaised : WaiterColors.ink,
      contentTextStyle: TextStyle(color: dark ? neutrals.ink : Colors.white),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusSm),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: neutrals.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusSm),
        borderSide: BorderSide(color: neutrals.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusSm),
        borderSide: BorderSide(color: neutrals.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusSm),
        borderSide: BorderSide(color: primary, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(WaiterSpacing.radiusPill),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
  );
}

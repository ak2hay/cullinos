import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';

ThemeData buildWaiterTheme() {
  final primary = WaiterColors.primary;
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: WaiterColors.scaffold,
  );
  final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
    bodyColor: WaiterColors.ink,
    displayColor: WaiterColors.ink,
  );
  final scheme = ColorScheme.fromSeed(
    seedColor: primary,
    brightness: Brightness.light,
    primary: primary,
    onPrimary: Colors.white,
    secondary: WaiterColors.primaryBright,
    surface: WaiterColors.surface,
    onSurface: WaiterColors.ink,
    onSurfaceVariant: WaiterColors.muted,
    error: WaiterColors.popularRed,
  );
  return base.copyWith(
    colorScheme: scheme,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: WaiterColors.scaffold,
      foregroundColor: WaiterColors.ink,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
    ),
    cardTheme: CardThemeData(
      color: WaiterColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusMd),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: WaiterColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusSm),
        borderSide: const BorderSide(color: WaiterColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusSm),
        borderSide: const BorderSide(color: WaiterColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusSm),
        borderSide: const BorderSide(color: WaiterColors.primary, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(WaiterSpacing.radiusPill),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
  );
}

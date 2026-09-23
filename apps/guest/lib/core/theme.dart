import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

/// Default Cullinos marketplace theme (classic forest green).
ThemeData buildGuestTheme() => buildGuestThemeFromPreset('classic');

ThemeData buildGuestThemeFromPreset(String? key) {
  return buildGuestThemeFromPalette(GuestPalette.fromKey(key));
}

ThemeData buildGuestThemeFromColors({
  String? themeKey,
  String? primaryColor,
  String? accentColor,
}) {
  return buildGuestThemeFromPalette(
    GuestPalette.resolve(
      themeKey: themeKey,
      primaryColor: primaryColor,
      accentColor: accentColor,
    ),
  );
}

ThemeData buildGuestThemeFromPalette(GuestPalette palette) {
  final primary = palette.primary;
  final soft = palette.soft;
  final deep = palette.deep;
  final bright = palette.bright;

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: GuestColors.scaffold,
  );

  final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
    bodyColor: GuestColors.ink,
    displayColor: GuestColors.ink,
  );

  final scheme = ColorScheme.fromSeed(
    seedColor: primary,
    brightness: Brightness.light,
    primary: primary,
    onPrimary: Colors.white,
    secondary: bright,
    onSecondary: Colors.white,
    surface: GuestColors.surface,
    onSurface: GuestColors.ink,
    onSurfaceVariant: GuestColors.muted,
    error: GuestColors.popularRed,
  );

  return base.copyWith(
    colorScheme: scheme,
    textTheme: textTheme,
    scaffoldBackgroundColor: GuestColors.scaffold,
    extensions: <ThemeExtension<dynamic>>[
      GuestBrandColors(
        primary: primary,
        soft: soft,
        deep: deep,
        bright: bright,
      ),
      GuestBrandColorsMarker(
        primary: primary,
        soft: soft,
        deep: deep,
        bright: bright,
      ),
    ],
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: _GuestFadeSlideTransitionsBuilder(),
        TargetPlatform.iOS: _GuestFadeSlideTransitionsBuilder(),
        TargetPlatform.windows: _GuestFadeSlideTransitionsBuilder(),
      },
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: GuestColors.scaffold,
      foregroundColor: GuestColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        color: GuestColors.ink,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: GuestColors.surface,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: GuestColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        borderSide: BorderSide(color: primary, width: 1.5),
      ),
      hintStyle: textTheme.bodyMedium?.copyWith(color: GuestColors.muted),
      labelStyle: textTheme.bodyMedium?.copyWith(color: GuestColors.muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        ),
        textStyle: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primary,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        side: BorderSide(color: soft, width: 1.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: soft,
      selectedColor: primary,
      labelStyle: textTheme.labelLarge?.copyWith(color: deep),
      secondaryLabelStyle: textTheme.labelLarge?.copyWith(color: Colors.white),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
      ),
      side: BorderSide.none,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: primary,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: GuestColors.ink,
      contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: GuestColors.border,
      thickness: 1,
    ),
  );
}

/// Theme extension for restaurant brand colors.
@immutable
class GuestBrandColors extends ThemeExtension<GuestBrandColors> {
  const GuestBrandColors({
    required this.primary,
    required this.soft,
    required this.deep,
    required this.bright,
  });

  final Color primary;
  final Color soft;
  final Color deep;
  final Color bright;

  static GuestBrandColors of(BuildContext context) {
    return Theme.of(context).extension<GuestBrandColors>() ??
        const GuestBrandColors(
          primary: GuestColors.primary,
          soft: GuestColors.primarySoft,
          deep: GuestColors.primaryDeep,
          bright: GuestColors.primaryBright,
        );
  }

  @override
  GuestBrandColors copyWith({
    Color? primary,
    Color? soft,
    Color? deep,
    Color? bright,
  }) {
    return GuestBrandColors(
      primary: primary ?? this.primary,
      soft: soft ?? this.soft,
      deep: deep ?? this.deep,
      bright: bright ?? this.bright,
    );
  }

  @override
  GuestBrandColors lerp(ThemeExtension<GuestBrandColors>? other, double t) {
    if (other is! GuestBrandColors) return this;
    return GuestBrandColors(
      primary: Color.lerp(primary, other.primary, t)!,
      soft: Color.lerp(soft, other.soft, t)!,
      deep: Color.lerp(deep, other.deep, t)!,
      bright: Color.lerp(bright, other.bright, t)!,
    );
  }
}

/// Soft fade + slight upward slide for Android page transitions.
class _GuestFadeSlideTransitionsBuilder extends PageTransitionsBuilder {
  const _GuestFadeSlideTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      ),
    );
  }
}

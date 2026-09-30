import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

/// Default Cullinos marketplace theme (classic forest green).
ThemeData buildGuestTheme([Brightness brightness = Brightness.light]) =>
    buildGuestThemeFromPreset('classic', brightness);

ThemeData buildGuestThemeFromPreset(
  String? key, [
  Brightness brightness = Brightness.light,
]) {
  return buildGuestThemeFromPalette(GuestPalette.fromKey(key), brightness);
}

ThemeData buildGuestThemeFromColors({
  String? themeKey,
  String? primaryColor,
  String? accentColor,
  Brightness brightness = Brightness.light,
}) {
  return buildGuestThemeFromPalette(
    GuestPalette.resolve(
      themeKey: themeKey,
      primaryColor: primaryColor,
      accentColor: accentColor,
    ),
    brightness,
  );
}

/// Brand colors tuned for the given brightness: presets are designed for light
/// surfaces, so dark mode lifts them for contrast and tints `soft` off the surface.
GuestBrandColors brandColorsFor(GuestPalette palette, Brightness brightness) {
  if (brightness == Brightness.light) {
    return GuestBrandColors(
      primary: palette.primary,
      soft: palette.soft,
      deep: palette.deep,
      bright: palette.bright,
    );
  }
  final surface = GuestNeutrals.dark.surface;
  final primary = Color.lerp(palette.bright, Colors.white, 0.12)!;
  return GuestBrandColors(
    primary: primary,
    soft: Color.alphaBlend(primary.withValues(alpha: 0.2), surface),
    deep: Color.lerp(palette.bright, Colors.white, 0.5)!,
    bright: Color.lerp(palette.bright, Colors.white, 0.25)!,
  );
}

ThemeData buildGuestThemeFromPalette(
  GuestPalette palette, [
  Brightness brightness = Brightness.light,
]) {
  final isDark = brightness == Brightness.dark;
  final neutrals = GuestNeutrals.of(brightness);
  final brand = brandColorsFor(palette, brightness);
  final primary = brand.primary;
  final soft = brand.soft;
  final deep = brand.deep;
  final bright = brand.bright;
  final onPrimary = isDark ? const Color(0xFF06231D) : Colors.white;

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
    seedColor: palette.primary,
    brightness: brightness,
    primary: primary,
    onPrimary: onPrimary,
    secondary: bright,
    onSecondary: onPrimary,
    surface: neutrals.surface,
    onSurface: neutrals.ink,
    onSurfaceVariant: neutrals.muted,
    outline: neutrals.border,
    outlineVariant: neutrals.borderLight,
    surfaceContainerHighest: neutrals.surfaceRaised,
    error: GuestColors.popularRed,
  );

  final overlay = isDark
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
    scaffoldBackgroundColor: neutrals.scaffold,
    canvasColor: neutrals.scaffold,
    extensions: <ThemeExtension<dynamic>>[
      neutrals,
      brand,
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
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.windows: _GuestFadeSlideTransitionsBuilder(),
      },
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: neutrals.scaffold,
      foregroundColor: neutrals.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      systemOverlayStyle: overlay,
      titleTextStyle: textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        color: neutrals.ink,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: neutrals.surface,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: neutrals.surface,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: neutrals.border,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: neutrals.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: neutrals.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: soft,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: neutrals.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        borderSide: isDark ? BorderSide(color: neutrals.border) : BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        borderSide: isDark ? BorderSide(color: neutrals.border) : BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        borderSide: BorderSide(color: primary, width: 1.5),
      ),
      hintStyle: textTheme.bodyMedium?.copyWith(color: neutrals.muted),
      labelStyle: textTheme.bodyMedium?.copyWith(color: neutrals.muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: onPrimary,
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
      secondaryLabelStyle: textTheme.labelLarge?.copyWith(color: onPrimary),
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
      backgroundColor: isDark ? neutrals.surfaceRaised : GuestColors.ink,
      contentTextStyle: textTheme.bodyMedium?.copyWith(
        color: isDark ? neutrals.ink : Colors.white,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: neutrals.border,
      thickness: 1,
    ),
    listTileTheme: ListTileThemeData(
      iconColor: neutrals.muted,
      textColor: neutrals.ink,
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
      reverseCurve: Curves.easeInCubic,
    );
    final exiting = CurvedAnimation(
      parent: secondaryAnimation,
      curve: Curves.easeOutCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(curved),
        child: FadeTransition(
          opacity: Tween<double>(begin: 1, end: 0.6).animate(exiting),
          child: ScaleTransition(
            scale: Tween<double>(begin: 1, end: 0.97).animate(exiting),
            child: child,
          ),
        ),
      ),
    );
  }
}

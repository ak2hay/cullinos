import 'package:flutter/material.dart';

/// Cullinos App–mirrored palette (classic forest green).
abstract final class WaiterColors {
  static const scaffold = Color(0xFFF8F9FA);
  static const surface = Colors.white;
  static const ink = Color(0xFF1A1C29);
  static const muted = Color(0xFF6B7280);
  static const border = Color(0xFFE5E7EB);
  static const borderLight = Color(0xFFF3F4F6);

  static const primary = Color(0xFF006D5B);
  static const primarySoft = Color(0xFFE6F4F1);
  static const primaryDeep = Color(0xFF004D40);
  static const primaryBright = Color(0xFF0A8A74);

  /// Primary tuned for contrast on dark surfaces.
  static const primaryOnDark = Color(0xFF3CC2A6);

  static const coral = Color(0xFFE07A5F);
  static const coralDeep = Color(0xFFC45C42);
  static const amber = Color(0xFFD4A017);
  static const popularRed = Color(0xFFDC2626);

  // Table status
  static const available = Color(0xFF16A34A);
  static const occupied = Color(0xFFDC2626);
  static const reserved = Color(0xFF2563EB);
  static const cleaning = Color(0xFFCA8A04);
  static const billing = Color(0xFF9333EA);
  static const merged = Color(0xFF0E7490);

  static WaiterNeutrals _neutrals(BuildContext context) =>
      Theme.of(context).extension<WaiterNeutrals>() ?? WaiterNeutrals.light;

  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color scaffoldOf(BuildContext context) => _neutrals(context).scaffold;
  static Color surfaceOf(BuildContext context) => _neutrals(context).surface;
  static Color inkOf(BuildContext context) => _neutrals(context).ink;
  static Color mutedOf(BuildContext context) => _neutrals(context).muted;
  static Color borderOf(BuildContext context) => _neutrals(context).border;
  static Color borderLightOf(BuildContext context) =>
      _neutrals(context).borderLight;

  static Color primaryOf(BuildContext context) =>
      Theme.of(context).colorScheme.primary;

  static Color primarySoftOf(BuildContext context) => Color.alphaBlend(
        Theme.of(context)
            .colorScheme
            .primary
            .withValues(alpha: isDark(context) ? 0.2 : 0.12),
        surfaceOf(context),
      );

  static Color primaryDeepOf(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return isDark(context)
        ? (Color.lerp(c, Colors.white, 0.35) ?? c)
        : (Color.lerp(c, Colors.black, 0.25) ?? c);
  }

  static Color primaryBrightOf(BuildContext context) =>
      isDark(context) ? primaryOnDark : primaryBright;

  /// Pastel badge background that stays readable in dark mode.
  static Color softOf(BuildContext context, Color light, Color accent) =>
      isDark(context)
          ? Color.alphaBlend(accent.withValues(alpha: 0.2), surfaceOf(context))
          : light;

  static Color statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'AVAILABLE':
        return available;
      case 'OCCUPIED':
        return occupied;
      case 'RESERVED':
        return reserved;
      case 'CLEANING':
        return cleaning;
      case 'BILLING':
        return billing;
      default:
        return muted;
    }
  }

  /// Table-status color brightened for dark backgrounds.
  static Color statusColorOf(BuildContext context, String status) {
    final base = statusColor(status);
    return isDark(context) ? (Color.lerp(base, Colors.white, 0.2) ?? base) : base;
  }
}

/// Brightness-dependent neutrals registered on the theme.
@immutable
class WaiterNeutrals extends ThemeExtension<WaiterNeutrals> {
  const WaiterNeutrals({
    required this.scaffold,
    required this.surface,
    required this.surfaceRaised,
    required this.ink,
    required this.muted,
    required this.border,
    required this.borderLight,
    required this.shadow,
  });

  final Color scaffold;
  final Color surface;
  final Color surfaceRaised;
  final Color ink;
  final Color muted;
  final Color border;
  final Color borderLight;
  final Color shadow;

  static const light = WaiterNeutrals(
    scaffold: Color(0xFFF5F6F8),
    surface: WaiterColors.surface,
    surfaceRaised: Colors.white,
    ink: WaiterColors.ink,
    muted: WaiterColors.muted,
    border: WaiterColors.border,
    borderLight: WaiterColors.borderLight,
    shadow: Color(0x14000000),
  );

  static const dark = WaiterNeutrals(
    scaffold: Color(0xFF0F1115),
    surface: Color(0xFF181B22),
    surfaceRaised: Color(0xFF20242D),
    ink: Color(0xFFF2F4F7),
    muted: Color(0xFF9AA3B2),
    border: Color(0xFF2A2F3A),
    borderLight: Color(0xFF22262F),
    shadow: Color(0x66000000),
  );

  static WaiterNeutrals of(Brightness brightness) =>
      brightness == Brightness.dark ? dark : light;

  @override
  WaiterNeutrals copyWith({
    Color? scaffold,
    Color? surface,
    Color? surfaceRaised,
    Color? ink,
    Color? muted,
    Color? border,
    Color? borderLight,
    Color? shadow,
  }) {
    return WaiterNeutrals(
      scaffold: scaffold ?? this.scaffold,
      surface: surface ?? this.surface,
      surfaceRaised: surfaceRaised ?? this.surfaceRaised,
      ink: ink ?? this.ink,
      muted: muted ?? this.muted,
      border: border ?? this.border,
      borderLight: borderLight ?? this.borderLight,
      shadow: shadow ?? this.shadow,
    );
  }

  @override
  WaiterNeutrals lerp(ThemeExtension<WaiterNeutrals>? other, double t) {
    if (other is! WaiterNeutrals) return this;
    return WaiterNeutrals(
      scaffold: Color.lerp(scaffold, other.scaffold, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderLight: Color.lerp(borderLight, other.borderLight, t)!,
      shadow: Color.lerp(shadow, other.shadow, t)!,
    );
  }
}

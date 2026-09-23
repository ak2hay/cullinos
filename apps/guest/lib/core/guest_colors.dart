import 'package:flutter/material.dart';

/// Named restaurant theme presets (Phase I). Marketplace stays [classic]/forest green.
class GuestPalette {
  const GuestPalette({
    required this.key,
    required this.label,
    required this.primary,
    required this.soft,
    required this.deep,
    required this.bright,
  });

  final String key;
  final String label;
  final Color primary;
  final Color soft;
  final Color deep;
  final Color bright;

  static const classic = GuestPalette(
    key: 'classic',
    label: 'Classic',
    primary: Color(0xFF006D5B),
    soft: Color(0xFFE6F4F1),
    deep: Color(0xFF004D40),
    bright: Color(0xFF0A8A74),
  );

  static const forest = GuestPalette(
    key: 'forest',
    label: 'Forest',
    primary: Color(0xFF2D6A4F),
    soft: Color(0xFFE8F5EF),
    deep: Color(0xFF1B4332),
    bright: Color(0xFF40916C),
  );

  static const ocean = GuestPalette(
    key: 'ocean',
    label: 'Ocean',
    primary: Color(0xFF0369A1),
    soft: Color(0xFFE0F2FE),
    deep: Color(0xFF0C4A6E),
    bright: Color(0xFF0EA5E9),
  );

  static const spice = GuestPalette(
    key: 'spice',
    label: 'Spice',
    primary: Color(0xFFC2410C),
    soft: Color(0xFFFFEDD5),
    deep: Color(0xFF7C2D12),
    bright: Color(0xFFEA580C),
  );

  static const charcoal = GuestPalette(
    key: 'charcoal',
    label: 'Charcoal',
    primary: Color(0xFF334155),
    soft: Color(0xFFF1F5F9),
    deep: Color(0xFF0F172A),
    bright: Color(0xFF475569),
  );

  static const sunset = GuestPalette(
    key: 'sunset',
    label: 'Sunset',
    primary: Color(0xFFBE123C),
    soft: Color(0xFFFFE4E6),
    deep: Color(0xFF881337),
    bright: Color(0xFFE11D48),
  );

  static const List<GuestPalette> all = [
    classic,
    forest,
    ocean,
    spice,
    charcoal,
    sunset,
  ];

  static GuestPalette fromKey(String? key) {
    if (key == null || key.isEmpty) return classic;
    for (final p in all) {
      if (p.key == key) return p;
    }
    return classic;
  }

  /// Prefer explicit hex colors when provided; otherwise resolve [themeKey].
  static GuestPalette resolve({
    String? themeKey,
    String? primaryColor,
    String? accentColor,
  }) {
    final base = fromKey(themeKey);
    final primary = _parseHex(primaryColor) ?? base.primary;
    final bright = _parseHex(accentColor) ?? base.bright;
    if (primary == base.primary && bright == base.bright) return base;
    return GuestPalette(
      key: base.key,
      label: base.label,
      primary: primary,
      soft: base.soft,
      deep: base.deep,
      bright: bright,
    );
  }

  static Color? _parseHex(String? raw) {
    if (raw == null) return null;
    var s = raw.trim();
    if (s.isEmpty) return null;
    if (s.startsWith('#')) s = s.substring(1);
    if (s.length == 6) s = 'FF$s';
    if (s.length != 8) return null;
    final value = int.tryParse(s, radix: 16);
    if (value == null) return null;
    return Color(value);
  }

  LinearGradient get promoGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [bright, primary],
      );

  LinearGradient get heroGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [bright, deep],
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GuestPalette &&
          key == other.key &&
          primary == other.primary &&
          soft == other.soft &&
          deep == other.deep &&
          bright == other.bright;

  @override
  int get hashCode => Object.hash(key, primary, soft, deep, bright);
}

/// Ambient restaurant palette under themed restaurant routes.
class GuestPaletteScope extends InheritedWidget {
  const GuestPaletteScope({
    super.key,
    required this.palette,
    required super.child,
  });

  final GuestPalette palette;

  static GuestPalette? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<GuestPaletteScope>()
        ?.palette;
  }

  static GuestPalette of(BuildContext context) {
    return maybeOf(context) ?? GuestPalette.classic;
  }

  @override
  bool updateShouldNotify(GuestPaletteScope oldWidget) =>
      palette != oldWidget.palette;
}

/// Forest-green marketplace palette for Cullinos App (reference redesign).
///
/// Prefer [primaryOf] / Theme [ColorScheme] under restaurant routes so outlet
/// presets apply. Static consts remain Cullinos marketplace green.
abstract final class GuestColors {
  static const scaffold = Color(0xFFF8F9FA);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1A1C29);
  static const muted = Color(0xFF6B7280);

  /// Brand primary (forest green) — marketplace default.
  static const primary = Color(0xFF006D5B);
  static const primaryBright = Color(0xFF0A8A74);
  static const primaryDeep = Color(0xFF004D40);
  static const primarySoft = Color(0xFFE6F4F1);

  /// Resolve against ambient restaurant palette / theme extension when present.
  static Color primaryOf(BuildContext context) {
    final scoped = GuestPaletteScope.maybeOf(context);
    if (scoped != null) return scoped.primary;
    final ext = Theme.of(context).extension<GuestBrandColorsMarker>();
    return ext?.primary ?? primary;
  }

  static Color primaryBrightOf(BuildContext context) {
    final scoped = GuestPaletteScope.maybeOf(context);
    if (scoped != null) return scoped.bright;
    return Theme.of(context).extension<GuestBrandColorsMarker>()?.bright ??
        primaryBright;
  }

  static Color primaryDeepOf(BuildContext context) {
    final scoped = GuestPaletteScope.maybeOf(context);
    if (scoped != null) return scoped.deep;
    return Theme.of(context).extension<GuestBrandColorsMarker>()?.deep ??
        primaryDeep;
  }

  static Color primarySoftOf(BuildContext context) {
    final scoped = GuestPaletteScope.maybeOf(context);
    if (scoped != null) return scoped.soft;
    return Theme.of(context).extension<GuestBrandColorsMarker>()?.soft ??
        primarySoft;
  }

  /// Legacy aliases — map old teal tokens to primary.
  static const teal = primary;
  static const tealBright = primaryBright;
  static const tealDeep = primaryDeep;
  static const tealSoft = primarySoft;

  /// Accent (offers / secondary highlights — soft orange, not primary CTA).
  static const coral = Color(0xFFF59E0B);
  static const coralDeep = Color(0xFFD97706);
  static const coralSoft = Color(0xFFFEF3C7);

  static const sky = Color(0xFF38BDF8);
  static const skyDeep = Color(0xFF0EA5E9);

  static const pink = Color(0xFFFB7185);
  static const pinkDeep = Color(0xFFF43F5E);

  static const popularRed = Color(0xFFE11D48);
  static const popularSoft = Color(0xFFFFE4E6);

  static const star = Color(0xFFFBBF24);
  static const border = Color(0xFFE5E7EB);
  static const borderLight = Color(0xFFF3F4F6);

  // Legacy violet aliases → primary.
  static const violet = primary;
  static const violetDeep = primaryDeep;
  static const violetSoft = primarySoft;
  static const lavender = primaryBright;

  static const LinearGradient promoTeal = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0A8A74), Color(0xFF006D5B)],
  );

  static const LinearGradient heroTeal = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0A8A74), Color(0xFF004D40)],
  );

  static const LinearGradient promoGreen = promoTeal;

  static const LinearGradient ctaPrimary = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0A8A74), Color(0xFF006D5B)],
  );

  /// Legacy coral CTA → primary green.
  static const LinearGradient ctaCoral = ctaPrimary;

  static const LinearGradient cardCoral = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
  );

  static const LinearGradient cardPink = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFB7185), Color(0xFFF43F5E)],
  );

  static const LinearGradient promoBlue = promoTeal;
  static const LinearGradient heroViolet = heroTeal;

  static List<LinearGradient> outletAccents = const [
    promoTeal,
    heroTeal,
    cardCoral,
    cardPink,
  ];
}

/// Lightweight marker so [GuestColors.primaryOf] can read theme extension
/// without importing theme.dart (avoids a circular import).
@immutable
class GuestBrandColorsMarker extends ThemeExtension<GuestBrandColorsMarker> {
  const GuestBrandColorsMarker({
    required this.primary,
    required this.soft,
    required this.deep,
    required this.bright,
  });

  final Color primary;
  final Color soft;
  final Color deep;
  final Color bright;

  @override
  GuestBrandColorsMarker copyWith({
    Color? primary,
    Color? soft,
    Color? deep,
    Color? bright,
  }) {
    return GuestBrandColorsMarker(
      primary: primary ?? this.primary,
      soft: soft ?? this.soft,
      deep: deep ?? this.deep,
      bright: bright ?? this.bright,
    );
  }

  @override
  GuestBrandColorsMarker lerp(
    ThemeExtension<GuestBrandColorsMarker>? other,
    double t,
  ) {
    if (other is! GuestBrandColorsMarker) return this;
    return GuestBrandColorsMarker(
      primary: Color.lerp(primary, other.primary, t)!,
      soft: Color.lerp(soft, other.soft, t)!,
      deep: Color.lerp(deep, other.deep, t)!,
      bright: Color.lerp(bright, other.bright, t)!,
    );
  }
}

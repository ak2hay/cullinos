import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';

abstract final class GuestSpacing {
  static const page = 16.0;
  static const section = 16.0;
  static const cardPad = 12.0;
  static const radiusLg = 20.0;
  static const radiusMd = 14.0;
  static const radiusSm = 10.0;
  static const radiusPill = 16.0;
  static const navHeight = 60.0;
  static const scanFabSize = 52.0;

  static List<BoxShadow> softShadow({Color? color}) => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.05),
          blurRadius: 16,
          offset: const Offset(0, 3),
        ),
        if (color != null)
          BoxShadow(
            color: color.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
      ];

  static List<BoxShadow> cardShadow = softShadow();

  static List<BoxShadow> navShadow = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 20,
      offset: const Offset(0, 6),
    ),
    BoxShadow(
      color: GuestColors.primary.withValues(alpha: 0.08),
      blurRadius: 16,
      offset: const Offset(0, 3),
    ),
  ];
}

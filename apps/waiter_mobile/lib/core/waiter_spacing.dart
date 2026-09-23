import 'package:flutter/material.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';

abstract final class WaiterSpacing {
  static const page = 20.0;
  static const section = 24.0;
  static const cardPad = 16.0;
  static const radiusLg = 24.0;
  static const radiusMd = 16.0;
  static const radiusSm = 12.0;
  static const radiusPill = 20.0;
  static const navHeight = 68.0;

  static List<BoxShadow> softShadow() => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.05),
          blurRadius: 20,
          offset: const Offset(0, 4),
        ),
      ];

  static List<BoxShadow> navShadow = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 24,
      offset: const Offset(0, 8),
    ),
    BoxShadow(
      color: WaiterColors.primary.withValues(alpha: 0.08),
      blurRadius: 20,
      offset: const Offset(0, 4),
    ),
  ];
}

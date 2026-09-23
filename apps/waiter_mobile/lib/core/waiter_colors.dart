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

  static Color primaryOf(BuildContext context) =>
      Theme.of(context).colorScheme.primary;

  static Color primarySoftOf(BuildContext context) =>
      Theme.of(context).colorScheme.primary.withValues(alpha: 0.12);

  static Color primaryDeepOf(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return Color.lerp(c, Colors.black, 0.25) ?? c;
  }

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
}

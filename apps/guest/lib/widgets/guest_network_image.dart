import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/config.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

/// Network image with branded gradient/icon fallback.
class GuestNetworkImage extends StatelessWidget {
  const GuestNetworkImage({
    super.key,
    this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.borderRadius,
    this.icon = Icons.restaurant_rounded,
    this.gradient,
  });

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final IconData icon;
  final Gradient? gradient;

  /// Absolute http(s) URL, or null if missing/unusable.
  static String? resolveUrl(String? raw) {
    if (raw == null) return null;
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      final apiBase = AppConfig.current.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
      final origin = apiBase.replaceFirst(RegExp(r'/api/v1$'), '');
      return '$origin$trimmed';
    }
    return null;
  }

  bool get _hasUrl => resolveUrl(url) != null;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(GuestSpacing.radiusSm);
    final fallback = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: radius,
        gradient: gradient ?? GuestColors.promoTeal,
      ),
      child: Icon(icon, color: Colors.white.withValues(alpha: 0.85), size: 32),
    );

    final resolved = resolveUrl(url);
    if (resolved == null) return fallback;

    return ClipRRect(
      borderRadius: radius,
      child: CachedNetworkImage(
        imageUrl: resolved,
        width: width,
        height: height,
        fit: fit,
        placeholder: (_, __) => Container(
          width: width,
          height: height,
          color: GuestColors.primarySoftOf(context),
          child: const Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
        errorWidget: (_, __, ___) => fallback,
      ),
    );
  }
}

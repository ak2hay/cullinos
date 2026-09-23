import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

class GuestGradientCard extends StatelessWidget {
  const GuestGradientCard({
    super.key,
    required this.child,
    this.gradient = GuestColors.promoTeal,
    this.height,
    this.width,
    this.padding,
    this.onTap,
  });

  final Widget child;
  final Gradient gradient;
  final double? height;
  final double? width;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      height: height,
      width: width,
      padding: padding ?? const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(GuestSpacing.radiusLg),
        boxShadow: GuestSpacing.softShadow(color: GuestColors.primaryOf(context)),
      ),
      child: child,
    );
    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}

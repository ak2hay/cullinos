import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/widgets/guest_motion.dart';

class GuestSoftCard extends StatelessWidget {
  const GuestSoftCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.color,
    this.margin,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Color? color;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      margin: margin,
      padding: padding ?? const EdgeInsets.all(GuestSpacing.cardPad),
      decoration: BoxDecoration(
        color: color ?? GuestColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
        boxShadow: GuestSpacing.softShadow(),
      ),
      child: child,
    );
    if (onTap == null) return content;
    return GuestPressable(
      onTap: onTap,
      scale: 0.98,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          child: content,
        ),
      ),
    );
  }
}

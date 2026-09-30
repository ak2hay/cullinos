import 'package:flutter/material.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/widgets/waiter_motion.dart';

class WaiterSoftCard extends StatelessWidget {
  const WaiterSoftCard({
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
    final card = Container(
      margin: margin,
      padding: padding ?? const EdgeInsets.all(WaiterSpacing.cardPad),
      decoration: BoxDecoration(
        color: color ?? WaiterColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusMd),
        boxShadow: WaiterSpacing.softShadow(),
        border: Border.all(color: WaiterColors.borderLightOf(context)),
      ),
      child: child,
    );
    if (onTap == null) return card;
    return WaiterPressable(
      scale: 0.98,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(WaiterSpacing.radiusMd),
        child: card,
      ),
    );
  }
}

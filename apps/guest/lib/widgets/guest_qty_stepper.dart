import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';

class GuestQtyStepper extends StatelessWidget {
  const GuestQtyStepper({
    super.key,
    required this.quantity,
    required this.onChanged,
    this.min = 0,
    this.compact = false,
  });

  final int quantity;
  final ValueChanged<int> onChanged;
  final int min;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final h = compact ? 32.0 : 36.0;
    final btn = compact ? 26.0 : 28.0;
    return Container(
      height: h,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: GuestColors.primarySoftOf(context),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _CircleBtn(
            size: btn,
            icon: Icons.remove_rounded,
            onTap: quantity > min ? () => onChanged(quantity - 1) : null,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text(
              '$quantity',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: GuestColors.ink,
                fontSize: 14,
              ),
            ),
          ),
          _CircleBtn(
            size: btn,
            icon: Icons.add_rounded,
            filled: true,
            onTap: () => onChanged(quantity + 1),
          ),
        ],
      ),
    );
  }
}

class _CircleBtn extends StatelessWidget {
  const _CircleBtn({
    required this.size,
    required this.icon,
    required this.onTap,
    this.filled = false,
  });

  final double size;
  final IconData icon;
  final VoidCallback? onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled
              ? GuestColors.primaryOf(context)
              : (onTap == null
                  ? GuestColors.primaryOf(context).withValues(alpha: 0.25)
                  : GuestColors.primarySoftOf(context)),
        ),
        child: Icon(
          icon,
          size: size * 0.55,
          color: filled ? Colors.white : GuestColors.primaryOf(context),
        ),
      ),
    );
  }
}

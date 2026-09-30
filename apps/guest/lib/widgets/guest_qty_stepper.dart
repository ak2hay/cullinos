import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cullinos_guest/core/guest_colors.dart';

class GuestQtyStepper extends StatefulWidget {
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
  State<GuestQtyStepper> createState() => _GuestQtyStepperState();
}

class _GuestQtyStepperState extends State<GuestQtyStepper> {
  bool _increasing = true;

  void _change(int next) {
    HapticFeedback.selectionClick();
    _increasing = next > widget.quantity;
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.compact ? 32.0 : 36.0;
    final btn = widget.compact ? 26.0 : 28.0;
    final direction = _increasing ? 1.0 : -1.0;
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
            onTap: widget.quantity > widget.min
                ? () => _change(widget.quantity - 1)
                : null,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              transitionBuilder: (child, animation) {
                final incoming = child.key == ValueKey(widget.quantity);
                final offset = Tween<Offset>(
                  begin: Offset(0, (incoming ? 0.6 : -0.6) * direction),
                  end: Offset.zero,
                ).animate(animation);
                return ClipRect(
                  child: SlideTransition(
                    position: offset,
                    child: FadeTransition(opacity: animation, child: child),
                  ),
                );
              },
              child: Text(
                '${widget.quantity}',
                key: ValueKey(widget.quantity),
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: GuestColors.inkOf(context),
                  fontSize: 14,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
          _CircleBtn(
            size: btn,
            icon: Icons.add_rounded,
            filled: true,
            onTap: () => _change(widget.quantity + 1),
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
    final primary = GuestColors.primaryOf(context);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled
              ? primary
              : (onTap == null
                  ? primary.withValues(alpha: 0.25)
                  : GuestColors.primarySoftOf(context)),
        ),
        child: Icon(
          icon,
          size: size * 0.55,
          color: filled ? Theme.of(context).colorScheme.onPrimary : primary,
        ),
      ),
    );
  }
}

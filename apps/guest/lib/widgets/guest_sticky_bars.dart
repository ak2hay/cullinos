import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

/// Sticky cart preview bar (menu / restaurant).
class GuestCartStickyBar extends StatelessWidget {
  const GuestCartStickyBar({
    super.key,
    required this.itemCount,
    required this.totalLabel,
    required this.onViewCart,
    this.orderModeLabel,
    this.onOrderMode,
    this.secondaryLabel,
    this.onSecondary,
  });

  final int itemCount;
  final String totalLabel;
  final VoidCallback onViewCart;
  final String? orderModeLabel;
  final VoidCallback? onOrderMode;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: GuestColors.surface,
            borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
            boxShadow: GuestSpacing.navShadow,
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: onViewCart,
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: GuestColors.coralSoft,
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusSm),
                        ),
                        child: const Icon(
                          Icons.shopping_bag_rounded,
                          color: GuestColors.coralDeep,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$itemCount items | $totalLabel',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            'View Cart',
                            style: TextStyle(
                              color: GuestColors.primaryOf(context),
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              if (orderModeLabel != null) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    orderModeLabel!,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      color: GuestColors.muted,
                    ),
                  ),
                ),
              ],
              if (secondaryLabel != null && onSecondary != null) ...[
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: onSecondary,
                  style: FilledButton.styleFrom(
                    backgroundColor: GuestColors.primaryOf(context),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(GuestSpacing.radiusSm),
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        secondaryLabel!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                      if (onOrderMode != null)
                        const Text(
                          'Reserve a table',
                          style: TextStyle(fontSize: 9, color: Colors.white70),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// PDP sticky add-to-cart bar.
class GuestAddToCartBar extends StatelessWidget {
  const GuestAddToCartBar({
    super.key,
    required this.quantity,
    required this.onQuantityChanged,
    required this.totalLabel,
    required this.onAdd,
  });

  final int quantity;
  final ValueChanged<int> onQuantityChanged;
  final String totalLabel;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: GuestColors.surface,
          boxShadow: GuestSpacing.navShadow,
        ),
        child: Row(
          children: [
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              decoration: BoxDecoration(
                color: GuestColors.borderLight,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                children: [
                  _qtyBtn(context, Icons.remove_rounded, () {
                    if (quantity > 1) onQuantityChanged(quantity - 1);
                  }),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      '$quantity',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  _qtyBtn(
                    context,
                    Icons.add_rounded,
                    () => onQuantityChanged(quantity + 1),
                    filled: true,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: onAdd,
                icon: const Icon(Icons.shopping_bag_outlined, size: 18),
                label: Text('Add to Cart | $totalLabel'),
                style: FilledButton.styleFrom(
                  backgroundColor: GuestColors.primaryOf(context),
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(GuestSpacing.radiusMd),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _qtyBtn(BuildContext context, IconData icon, VoidCallback onTap, {bool filled = false}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled ? GuestColors.primaryOf(context) : GuestColors.primarySoftOf(context),
        ),
        child: Icon(
          icon,
          size: 16,
          color: filled ? Colors.white : GuestColors.primaryOf(context),
        ),
      ),
    );
  }
}

class GuestCheckoutStepper extends StatelessWidget {
  const GuestCheckoutStepper({
    super.key,
    required this.currentStep,
  });

  /// 0=Cart, 1=Checkout, 2=Payment, 3=Confirmation
  final int currentStep;

  static const _labels = ['Cart', 'Checkout', 'Payment', 'Confirmation'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          for (var i = 0; i < _labels.length; i++) ...[
            if (i > 0)
              Expanded(
                child: Container(
                  height: 2,
                  color: i <= currentStep
                      ? GuestColors.primaryOf(context)
                      : GuestColors.border,
                ),
              ),
            _StepDot(
              index: i + 1,
              label: _labels[i],
              done: i < currentStep,
              active: i == currentStep,
            ),
          ],
        ],
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({
    required this.index,
    required this.label,
    required this.done,
    required this.active,
  });

  final int index;
  final String label;
  final bool done;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = done || active ? GuestColors.primaryOf(context) : GuestColors.muted;
    return Column(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done || active ? GuestColors.primaryOf(context) : GuestColors.surface,
            border: Border.all(color: color, width: 1.5),
          ),
          child: Center(
            child: done
                ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                : Text(
                    '$index',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: active ? Colors.white : GuestColors.muted,
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: color,
          ),
        ),
      ],
    );
  }
}

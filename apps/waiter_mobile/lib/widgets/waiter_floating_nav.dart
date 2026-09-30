import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';

class WaiterFloatingNav extends StatelessWidget {
  const WaiterFloatingNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  /// Shell branch index 0..3 (Floor, Calls, Orders, More).
  final int currentIndex;
  final ValueChanged<int> onTap;

  static const _count = 4;

  void _select(int index) {
    if (index != currentIndex) HapticFeedback.selectionClick();
    onTap(index);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final items = [
      (Icons.grid_view_outlined, Icons.grid_view_rounded, l10n.floor),
      (Icons.notifications_outlined, Icons.notifications_active, l10n.calls),
      (Icons.receipt_long_outlined, Icons.receipt_long, l10n.orders),
      (Icons.more_horiz_rounded, Icons.more_horiz_rounded, l10n.more),
    ];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Container(
          height: 64,
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: WaiterColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: WaiterColors.borderLightOf(context)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(
                    alpha: WaiterColors.isDark(context) ? 0.4 : 0.08),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            children: [
              AnimatedAlign(
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                alignment: Alignment(-1 + currentIndex * 2 / (_count - 1), 0),
                child: FractionallySizedBox(
                  widthFactor: 1 / _count,
                  heightFactor: 1,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: WaiterColors.primarySoftOf(context),
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < items.length; i++)
                    _NavItem(
                      icon: items[i].$1,
                      activeIcon: items[i].$2,
                      label: items[i].$3,
                      selected: currentIndex == i,
                      onTap: () => _select(i),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected
        ? WaiterColors.primaryOf(context)
        : WaiterColors.mutedOf(context);
    return Expanded(
      child: Semantics(
        selected: selected,
        button: true,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                scale: selected ? 1.08 : 1,
                duration: const Duration(milliseconds: 200),
                child:
                    Icon(selected ? activeIcon : icon, color: color, size: 22),
              ),
              const SizedBox(height: 2),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  color: color,
                ),
                child:
                    Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

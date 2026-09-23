import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

class GuestNavItem {
  const GuestNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    this.raised = false,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool raised;
}

/// Bottom bar: Home · Explore · Scan (raised) · Orders · Profile
class GuestFloatingNav extends StatelessWidget {
  const GuestFloatingNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  /// Highlighted slot among [items] (0–4). Use -1 when none (e.g. Scan route).
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<GuestNavItem> items;

  @override
  Widget build(BuildContext context) {
    assert(items.length == 5, 'Guest nav expects 5 slots with raised Scan');
    final scanIndex = items.indexWhere((e) => e.raised);
    final center = scanIndex >= 0 ? scanIndex : 2;

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: SizedBox(
        height: GuestSpacing.navHeight + 12,
        child: Stack(
          alignment: Alignment.bottomCenter,
          clipBehavior: Clip.none,
          children: [
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                height: GuestSpacing.navHeight,
                padding: const EdgeInsets.symmetric(horizontal: 6),
                decoration: BoxDecoration(
                  color: GuestColors.surface,
                  borderRadius: BorderRadius.circular(GuestSpacing.radiusLg),
                  boxShadow: GuestSpacing.navShadow,
                ),
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      if (i == center)
                        const Expanded(child: SizedBox())
                      else
                        Expanded(
                          child: _NavButton(
                            item: items[i],
                            selected: i == currentIndex,
                            onTap: () => onTap(i),
                          ),
                        ),
                  ],
                ),
              ),
            ),
            Positioned(
              bottom: 16,
              child: _ScanFab(
                selected: currentIndex == center,
                onTap: () => onTap(center),
                item: items[center],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanFab extends StatelessWidget {
  const _ScanFab({
    required this.selected,
    required this.onTap,
    required this.item,
  });

  final bool selected;
  final VoidCallback onTap;
  final GuestNavItem item;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedScale(
        scale: selected ? 1.05 : 1.0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutBack,
        child: Container(
          width: GuestSpacing.scanFabSize,
          height: GuestSpacing.scanFabSize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: GuestColors.primaryOf(context),
            boxShadow: [
              BoxShadow(
                color: GuestColors.primaryOf(context).withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
            border: Border.all(color: GuestColors.surface, width: 4),
          ),
          child: Icon(
            selected ? item.activeIcon : item.icon,
            color: Colors.white,
            size: 26,
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final GuestNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 240),
            curve: Curves.easeOutCubic,
            width: selected ? 40 : 36,
            height: selected ? 40 : 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? GuestColors.primarySoftOf(context) : Colors.transparent,
            ),
            child: Icon(
              selected ? item.activeIcon : item.icon,
              color: selected ? GuestColors.primaryOf(context) : GuestColors.muted,
              size: 22,
            ),
          ),
          const SizedBox(height: 2),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: TextStyle(
              fontSize: 10,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? GuestColors.primaryOf(context) : GuestColors.muted,
            ),
            child: Text(item.label),
          ),
        ],
      ),
    );
  }
}

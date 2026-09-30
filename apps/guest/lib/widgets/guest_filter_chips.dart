import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

class GuestFilterPill extends StatelessWidget {
  const GuestFilterPill({
    super.key,
    required this.label,
    this.icon,
    this.selected = false,
    this.showChevron = false,
    this.onTap,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final bool showChevron;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? GuestColors.primaryOf(context) : GuestColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? GuestColors.primaryOf(context) : GuestColors.borderOf(context),
            ),
            boxShadow: selected ? GuestSpacing.softShadow(color: GuestColors.primaryOf(context)) : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 16,
                  color: selected ? Colors.white : GuestColors.mutedOf(context),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : GuestColors.inkOf(context),
                ),
              ),
              if (showChevron) ...[
                const SizedBox(width: 2),
                Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 18,
                  color: selected ? Colors.white : GuestColors.mutedOf(context),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class GuestCategorySquare extends StatelessWidget {
  const GuestCategorySquare({
    super.key,
    required this.label,
    required this.icon,
    this.selected = false,
    this.background,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final Color? background;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: selected
                    ? GuestColors.primarySoftOf(context)
                    : (background ?? GuestColors.surfaceOf(context)),
                borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
                border: Border.all(
                  color: selected ? GuestColors.primaryOf(context) : GuestColors.borderOf(context),
                  width: selected ? 1.5 : 1,
                ),
                boxShadow: GuestSpacing.softShadow(),
              ),
              child: Icon(
                icon,
                color: selected ? GuestColors.primaryDeepOf(context) : GuestColors.inkOf(context),
                size: 26,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: GuestColors.inkOf(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GuestCuisineCircle extends StatelessWidget {
  const GuestCuisineCircle({
    super.key,
    required this.label,
    this.imageUrl,
    this.onTap,
  });

  final String label;
  final String? imageUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 84,
        child: Column(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: GuestSpacing.softShadow(),
                border: Border.all(color: GuestColors.surfaceOf(context), width: 3),
              ),
              clipBehavior: Clip.antiAlias,
              child: imageUrl != null && imageUrl!.isNotEmpty
                  ? Image.network(imageUrl!, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _fallback())
                  : _fallback(),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: GuestColors.inkOf(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallback() => Container(
        decoration: const BoxDecoration(gradient: GuestColors.promoTeal),
        child: const Icon(Icons.ramen_dining_rounded, color: Colors.white),
      );
}

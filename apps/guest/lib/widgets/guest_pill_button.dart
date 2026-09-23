import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

class GuestPillButton extends StatelessWidget {
  const GuestPillButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
    this.secondary = false,
    this.subtitle,
    this.trailing,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final bool secondary;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return SizedBox(
      width: double.infinity,
      height: subtitle != null ? 64 : 56,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          color: secondary
              ? GuestColors.surface
              : (enabled ? GuestColors.primaryOf(context) : GuestColors.primarySoftOf(context)),
          border: secondary
              ? Border.all(color: GuestColors.primarySoftOf(context), width: 1.5)
              : null,
          boxShadow: secondary || !enabled
              ? null
              : GuestSpacing.softShadow(color: GuestColors.primaryOf(context)),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: enabled ? onPressed : null,
            borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: loading
                  ? const Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.white,
                        ),
                      ),
                    )
                  : Row(
                      children: [
                        if (icon != null) ...[
                          Icon(
                            icon,
                            color: secondary
                                ? GuestColors.primaryOf(context)
                                : Colors.white,
                            size: 22,
                          ),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                label,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: secondary
                                          ? GuestColors.primaryOf(context)
                                          : (enabled
                                              ? Colors.white
                                              : GuestColors.primaryDeepOf(context)),
                                    ),
                              ),
                              if (subtitle != null)
                                Text(
                                  subtitle!,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: secondary
                                        ? GuestColors.muted
                                        : Colors.white.withValues(alpha: 0.85),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (trailing != null) trailing!,
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

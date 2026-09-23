import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';

class GuestSectionHeader extends StatelessWidget {
  const GuestSectionHeader({
    super.key,
    required this.title,
    this.trailingLabel,
    this.onTrailing,
    this.emoji,
    this.subtitle,
  });

  final String title;
  final String? trailingLabel;
  final VoidCallback? onTrailing;
  final String? emoji;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      if (emoji != null)
                        TextSpan(
                          text: '$emoji ',
                          style: const TextStyle(fontSize: 18),
                        ),
                      TextSpan(
                        text: title,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: GuestColors.ink,
                            ),
                      ),
                    ],
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: GuestColors.muted,
                        ),
                  ),
                ],
              ],
            ),
          ),
          if (trailingLabel != null)
            TextButton(
              onPressed: onTrailing,
              style: TextButton.styleFrom(
                foregroundColor: GuestColors.primaryOf(context),
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    trailingLabel!,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const Icon(Icons.chevron_right_rounded, size: 18),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

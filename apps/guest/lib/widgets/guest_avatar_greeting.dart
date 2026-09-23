import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';

class GuestAvatarGreeting extends StatelessWidget {
  const GuestAvatarGreeting({
    super.key,
    required this.name,
    this.trailing,
  });

  final String name;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final initial =
        trimmed.isEmpty ? 'G' : trimmed.substring(0, 1).toUpperCase();
    return Row(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: GuestColors.heroTeal,
            boxShadow: [
              BoxShadow(
                color: GuestColors.primaryOf(context).withValues(alpha: 0.28),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Text(
            initial,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 20,
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Hello,',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: GuestColors.muted,
                      fontWeight: FontWeight.w500,
                    ),
              ),
              Text(
                name.trim().isEmpty ? 'Guest' : name.trim(),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

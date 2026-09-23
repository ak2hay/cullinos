import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

enum GuestBadgeTone { primary, popular, soft, dark, warning }

class GuestBadge extends StatelessWidget {
  const GuestBadge({
    super.key,
    required this.label,
    this.icon,
    this.tone = GuestBadgeTone.primary,
    this.compact = false,
  });

  final String label;
  final IconData? icon;
  final GuestBadgeTone tone;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      GuestBadgeTone.primary => (GuestColors.primaryOf(context), Colors.white),
      GuestBadgeTone.popular => (GuestColors.popularRed, Colors.white),
      GuestBadgeTone.soft => (GuestColors.primarySoftOf(context), GuestColors.primaryDeepOf(context)),
      GuestBadgeTone.dark => (Colors.black.withValues(alpha: 0.72), Colors.white),
      GuestBadgeTone.warning => (GuestColors.coralSoft, GuestColors.coralDeep),
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 4 : 5,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(GuestSpacing.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: compact ? 11 : 13, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class GuestOfferChip extends StatelessWidget {
  const GuestOfferChip({
    super.key,
    required this.label,
    this.icon = Icons.local_offer_outlined,
  });

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: GuestColors.primarySoftOf(context),
        borderRadius: BorderRadius.circular(GuestSpacing.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: GuestColors.primaryOf(context)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: GuestColors.primaryDeepOf(context),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class GuestOpenNowDot extends StatelessWidget {
  const GuestOpenNowDot({super.key, this.open = true, this.label});

  final bool open;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final text = label ?? (open ? 'Open Now' : 'Closed');
    final color = open ? GuestColors.primaryOf(context) : GuestColors.muted;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          text,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

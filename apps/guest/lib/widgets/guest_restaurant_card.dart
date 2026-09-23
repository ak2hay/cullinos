import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/widgets/guest_badges.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';

class GuestRestaurantCardHorizontal extends StatelessWidget {
  const GuestRestaurantCardHorizontal({
    super.key,
    required this.name,
    required this.onTap,
    this.imageUrl,
    this.cuisines,
    this.rating,
    this.reviewLabel,
    this.distanceKm,
    this.etaMinutes,
    this.offerLabel,
    this.badgeLabel,
    this.isOpen,
    this.favorited = false,
    this.onFavorite,
  });

  final String name;
  final VoidCallback onTap;
  final String? imageUrl;
  final String? cuisines;
  final double? rating;
  final String? reviewLabel;
  final double? distanceKm;
  final String? etaMinutes;
  final String? offerLabel;
  final String? badgeLabel;
  final bool? isOpen;
  final bool favorited;
  final VoidCallback? onFavorite;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 240,
        decoration: BoxDecoration(
          color: GuestColors.surface,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          boxShadow: GuestSpacing.cardShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 130,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  GuestNetworkImage(url: imageUrl, borderRadius: BorderRadius.zero),
                  if (badgeLabel != null)
                    Positioned(
                      top: 10,
                      left: 10,
                      child: GuestBadge(label: badgeLabel!, compact: true),
                    ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: _HeartBtn(favorited: favorited, onTap: onFavorite),
                  ),
                  if (etaMinutes != null)
                    Positioned(
                      bottom: 10,
                      left: 10,
                      child: GuestBadge(
                        label: etaMinutes!,
                        tone: GuestBadgeTone.dark,
                        icon: Icons.schedule_rounded,
                        compact: true,
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: GuestColors.ink,
                          ),
                        ),
                      ),
                      if (isOpen != null) GuestOpenNowDot(open: isOpen!),
                    ],
                  ),
                  if (cuisines != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      cuisines!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: GuestColors.muted,
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (rating != null) ...[
                        const Icon(Icons.star_rounded,
                            size: 15, color: GuestColors.star),
                        const SizedBox(width: 2),
                        Text(
                          rating!.toStringAsFixed(1),
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                        if (reviewLabel != null)
                          Text(
                            ' ($reviewLabel)',
                            style: const TextStyle(
                              fontSize: 11,
                              color: GuestColors.muted,
                            ),
                          ),
                      ],
                      if (distanceKm != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          '${distanceKm!.toStringAsFixed(1)} km',
                          style: const TextStyle(
                            fontSize: 11,
                            color: GuestColors.muted,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (offerLabel != null) ...[
                    const SizedBox(height: 8),
                    GuestOfferChip(label: offerLabel!),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GuestRestaurantListCard extends StatelessWidget {
  const GuestRestaurantListCard({
    super.key,
    required this.name,
    required this.onTap,
    this.imageUrl,
    this.cuisines,
    this.rating,
    this.reviewLabel,
    this.distanceKm,
    this.etaMinutes,
    this.offerLabels = const [],
    this.badgeLabel,
    this.isOpen = true,
    this.favorited = false,
    this.onFavorite,
    this.onMore,
  });

  final String name;
  final VoidCallback onTap;
  final String? imageUrl;
  final String? cuisines;
  final double? rating;
  final String? reviewLabel;
  final double? distanceKm;
  final String? etaMinutes;
  final List<String> offerLabels;
  final String? badgeLabel;
  final bool isOpen;
  final bool favorited;
  final VoidCallback? onFavorite;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: GuestColors.surface,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          boxShadow: GuestSpacing.cardShadow,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 110,
              height: 110,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  GuestNetworkImage(
                    url: imageUrl,
                    borderRadius:
                        BorderRadius.circular(GuestSpacing.radiusSm),
                  ),
                  if (badgeLabel != null)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: GuestBadge(
                        label: badgeLabel!,
                        compact: true,
                        tone: badgeLabel!.toLowerCase().contains('popular')
                            ? GuestBadgeTone.popular
                            : GuestBadgeTone.primary,
                      ),
                    ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: _HeartBtn(favorited: favorited, onTap: onFavorite),
                  ),
                  if (etaMinutes != null)
                    Positioned(
                      bottom: 6,
                      right: 6,
                      child: GuestBadge(
                        label: etaMinutes!,
                        tone: GuestBadgeTone.dark,
                        compact: true,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                      ),
                      GuestOpenNowDot(open: isOpen),
                      if (onMore != null)
                        IconButton(
                          onPressed: onMore,
                          icon: const Icon(Icons.more_vert_rounded, size: 18),
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                    ],
                  ),
                  if (cuisines != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      cuisines!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: GuestColors.muted,
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (rating != null) ...[
                        const Icon(Icons.star_rounded,
                            size: 15, color: GuestColors.star),
                        const SizedBox(width: 2),
                        Text(
                          '${rating!.toStringAsFixed(1)}${reviewLabel != null ? ' ($reviewLabel)' : ''}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                      if (distanceKm != null) ...[
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 8),
                          width: 1,
                          height: 12,
                          color: GuestColors.border,
                        ),
                        Text(
                          '${distanceKm!.toStringAsFixed(1)} km',
                          style: const TextStyle(
                            fontSize: 12,
                            color: GuestColors.muted,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (offerLabels.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        for (final o in offerLabels.take(2))
                          GuestOfferChip(
                            label: o,
                            icon: o.toLowerCase().contains('delivery')
                                ? Icons.local_shipping_outlined
                                : Icons.local_offer_outlined,
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeartBtn extends StatelessWidget {
  const _HeartBtn({required this.favorited, this.onTap});

  final bool favorited;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.92),
          shape: BoxShape.circle,
        ),
        child: Icon(
          favorited ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          size: 16,
          color: favorited ? GuestColors.popularRed : GuestColors.ink,
        ),
      ),
    );
  }
}

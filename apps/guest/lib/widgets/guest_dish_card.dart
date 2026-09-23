import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/widgets/guest_badges.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';

class GuestDishCard extends StatelessWidget {
  const GuestDishCard({
    super.key,
    required this.name,
    required this.priceLabel,
    required this.onAdd,
    this.imageUrl,
    this.description,
    this.rating,
    this.reviewLabel,
    this.badgeLabel,
    this.onTap,
    this.onFavorite,
    this.favorited = false,
    this.width = 168,
  });

  final String name;
  final String priceLabel;
  final VoidCallback onAdd;
  final String? imageUrl;
  final String? description;
  final double? rating;
  final String? reviewLabel;
  final String? badgeLabel;
  final VoidCallback? onTap;
  final VoidCallback? onFavorite;
  final bool favorited;
  final double width;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
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
              height: 110,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  GuestNetworkImage(
                    url: imageUrl,
                    icon: Icons.lunch_dining_rounded,
                    borderRadius: BorderRadius.zero,
                  ),
                  if (badgeLabel != null)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: GuestBadge(
                        label: badgeLabel!,
                        compact: true,
                        tone: badgeLabel!.toLowerCase().contains('popular')
                            ? GuestBadgeTone.popular
                            : GuestBadgeTone.primary,
                      ),
                    ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: GestureDetector(
                      onTap: onFavorite,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          favorited
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          size: 15,
                          color: favorited
                              ? GuestColors.popularRed
                              : GuestColors.ink,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                  if (description != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      description!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: GuestColors.muted,
                        height: 1.3,
                      ),
                    ),
                  ],
                  if (rating != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.star_rounded,
                            size: 13, color: GuestColors.star),
                        const SizedBox(width: 2),
                        Text(
                          '${rating!.toStringAsFixed(1)}${reviewLabel != null ? ' ($reviewLabel)' : ''}',
                          style: const TextStyle(fontSize: 11),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          priceLabel,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: onAdd,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            borderRadius:
                                BorderRadius.circular(GuestSpacing.radiusSm),
                            border: Border.all(color: GuestColors.primaryOf(context)),
                          ),
                          child: Text(
                            'ADD +',
                            style: TextStyle(
                              color: GuestColors.primaryOf(context),
                              fontWeight: FontWeight.w800,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GuestUpsellDishCard extends StatelessWidget {
  const GuestUpsellDishCard({
    super.key,
    required this.name,
    required this.priceLabel,
    required this.onAdd,
    this.imageUrl,
  });

  final String name;
  final String priceLabel;
  final VoidCallback onAdd;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 130,
      decoration: BoxDecoration(
        color: GuestColors.surface,
        borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
        boxShadow: GuestSpacing.cardShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GuestNetworkImage(
            url: imageUrl,
            height: 90,
            width: 130,
            icon: Icons.lunch_dining_rounded,
            borderRadius: BorderRadius.zero,
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  priceLabel,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                    color: GuestColors.muted,
                  ),
                ),
                const SizedBox(height: 6),
                Align(
                  alignment: Alignment.centerRight,
                  child: GestureDetector(
                    onTap: onAdd,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        borderRadius:
                            BorderRadius.circular(GuestSpacing.radiusSm),
                        border: Border.all(color: GuestColors.primaryOf(context)),
                      ),
                      child: Text(
                        '+ Add',
                        style: TextStyle(
                          color: GuestColors.primaryOf(context),
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

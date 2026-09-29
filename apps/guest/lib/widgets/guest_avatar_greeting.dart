import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';

class GuestAvatarGreeting extends StatelessWidget {
  const GuestAvatarGreeting({
    super.key,
    required this.name,
    this.photoUrl,
    this.onAvatarTap,
    this.showSetPhotoHint = false,
    this.trailing,
  });

  final String name;
  final String? photoUrl;
  final VoidCallback? onAvatarTap;
  final bool showSetPhotoHint;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final initial =
        trimmed.isEmpty ? 'G' : trimmed.substring(0, 1).toUpperCase();
    final hasPhoto = photoUrl != null && photoUrl!.trim().isNotEmpty;

    final avatar = Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: hasPhoto ? null : GuestColors.heroTeal,
        boxShadow: [
          BoxShadow(
            color: GuestColors.primaryOf(context).withValues(alpha: 0.28),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
        image: hasPhoto
            ? DecorationImage(
                image: NetworkImage(photoUrl!),
                fit: BoxFit.cover,
              )
            : null,
      ),
      alignment: Alignment.center,
      child: hasPhoto
          ? null
          : Text(
              initial,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
    );

    return Row(
      children: [
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onAvatarTap,
                customBorder: const CircleBorder(),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    avatar,
                    if (onAvatarTap != null)
                      Positioned(
                        right: -2,
                        bottom: -2,
                        child: Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: GuestColors.primaryOf(context),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: GuestColors.scaffold,
                              width: 2,
                            ),
                          ),
                          child: const Icon(
                            Icons.camera_alt_rounded,
                            size: 12,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (showSetPhotoHint) ...[
              const SizedBox(height: 6),
              GestureDetector(
                onTap: onAvatarTap,
                child: Text(
                  hasPhoto ? 'Change photo' : 'Set profile picture',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: GuestColors.primaryOf(context),
                  ),
                ),
              ),
            ],
          ],
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

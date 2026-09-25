import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/orders/push_service.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

TextStyle _fontFor(String? family, {double? size, FontWeight? weight, Color? color}) {
  final name = (family ?? 'Inter').trim();
  switch (name) {
    case 'Poppins':
      return GoogleFonts.poppins(fontSize: size, fontWeight: weight, color: color);
    case 'Montserrat':
      return GoogleFonts.montserrat(fontSize: size, fontWeight: weight, color: color);
    case 'Playfair Display':
      return GoogleFonts.playfairDisplay(fontSize: size, fontWeight: weight, color: color);
    case 'Inter':
    default:
      return GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color);
  }
}

Color? _parseColor(dynamic raw) {
  if (raw == null) return null;
  final s = raw.toString().trim();
  if (s.isEmpty) return null;
  var hex = s.replaceFirst('#', '');
  if (hex.length == 6) hex = 'FF$hex';
  if (hex.length != 8) return null;
  final value = int.tryParse(hex, radix: 16);
  if (value == null) return null;
  return Color(value);
}

Map<String, dynamic> _creativeFromData(Map<String, dynamic> data) {
  final nested = data['creative'];
  if (nested is Map) {
    return Map<String, dynamic>.from(nested);
  }
  if (nested is String && nested.isNotEmpty) {
    try {
      final decoded = jsonDecode(nested);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {}
  }
  return {
    if (data['creative_titleColor'] != null) 'titleColor': data['creative_titleColor'],
    if (data['creative_bodyColor'] != null) 'bodyColor': data['creative_bodyColor'],
    if (data['creative_bgColor'] != null) 'bgColor': data['creative_bgColor'],
    if (data['creative_accentColor'] != null) 'accentColor': data['creative_accentColor'],
    if (data['creative_fontFamily'] != null) 'fontFamily': data['creative_fontFamily'],
    if (data['creative_ctaLabel'] != null) 'ctaLabel': data['creative_ctaLabel'],
  };
}

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  List<dynamic> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await ref.read(guestApiProvider).notifications();
      setState(() => _rows = rows);
    } catch (_) {
      setState(() => _rows = []);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _openNotification(Map<String, dynamic> n) async {
    final id = n['id'].toString();
    try {
      await ref.read(guestApiProvider).markNotificationRead(id);
      await ref.read(guestApiProvider).deleteNotification(id);
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _rows = _rows
          .where((r) => Map<String, dynamic>.from(r as Map)['id']?.toString() != id)
          .toList();
    });
    final data = n['data'] is Map
        ? Map<String, dynamic>.from(n['data'] as Map)
        : <String, dynamic>{};
    final orderId = data['orderId']?.toString();
    final deepLink = data['deepLink']?.toString();
    if (orderId != null && orderId.isNotEmpty) {
      context.push('/orders/$orderId');
      return;
    }
    if (deepLink != null && deepLink.isNotEmpty) {
      GuestPushService.openDeepLink(deepLink);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _rows.where((r) {
      final n = Map<String, dynamic>.from(r as Map);
      return n['readAt'] == null;
    }).length;

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        backgroundColor: GuestColors.scaffold,
        foregroundColor: GuestColors.ink,
        elevation: 0,
        leading: const GuestBackButton(fallbackPath: '/profile'),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Notifications',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            if (unreadCount > 0)
              Text(
                '$unreadCount unread',
                style: const TextStyle(
                  fontSize: 12,
                  color: GuestColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
        actions: [
          if (unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton.icon(
                onPressed: () async {
                  await ref.read(guestApiProvider).markAllNotificationsRead();
                  await _load();
                },
                icon: const Icon(Icons.done_all_rounded, size: 18),
                label: const Text('All read'),
                style: TextButton.styleFrom(
                  foregroundColor: GuestColors.primary,
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const GuestLoading()
          : _rows.isEmpty
              ? const GuestEmptyState(
                  message: 'No notifications yet.',
                  icon: Icons.notifications_none_rounded,
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(GuestSpacing.page),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final n = Map<String, dynamic>.from(_rows[i] as Map);
                    final unread = n['readAt'] == null;
                    final data = n['data'] is Map
                        ? Map<String, dynamic>.from(n['data'] as Map)
                        : <String, dynamic>{};
                    final creative = _creativeFromData(data);
                    final imageUrl = (data['imageUrl'] ?? creative['imageUrl'])
                        ?.toString();
                    final hasRich = (imageUrl != null && imageUrl.isNotEmpty) ||
                        creative.isNotEmpty;

                    if (hasRich) {
                      return _RichNotificationCard(
                        title: n['title']?.toString() ?? '',
                        body: n['body']?.toString() ?? '',
                        unread: unread,
                        imageUrl: imageUrl,
                        creative: creative,
                        onTap: () => _openNotification(n),
                      );
                    }

                    return GuestSoftCard(
                      color: unread
                          ? GuestColors.primarySoft
                          : GuestColors.surface,
                      onTap: () => _openNotification(n),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: unread
                                  ? GuestColors.primary
                                  : GuestColors.borderLight,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              unread
                                  ? Icons.notifications_active_rounded
                                  : Icons.notifications_outlined,
                              size: 18,
                              color: unread ? Colors.white : GuestColors.muted,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  n['title']?.toString() ?? '',
                                  style: TextStyle(
                                    fontWeight: unread
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    color: GuestColors.ink,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  n['body']?.toString() ?? '',
                                  style: const TextStyle(
                                    color: GuestColors.muted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

class _RichNotificationCard extends StatelessWidget {
  const _RichNotificationCard({
    required this.title,
    required this.body,
    required this.unread,
    required this.creative,
    required this.onTap,
    this.imageUrl,
  });

  final String title;
  final String body;
  final bool unread;
  final String? imageUrl;
  final Map<String, dynamic> creative;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = _parseColor(creative['bgColor']) ?? GuestColors.surface;
    final titleColor = _parseColor(creative['titleColor']) ?? GuestColors.ink;
    final bodyColor = _parseColor(creative['bodyColor']) ?? GuestColors.muted;
    final accent = _parseColor(creative['accentColor']) ?? GuestColors.primary;
    final font = creative['fontFamily']?.toString();
    final cta = creative['ctaLabel']?.toString() ?? 'Open';
    final headlineSize =
        double.tryParse(creative['headlineSize']?.toString() ?? '') ?? 17;

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (imageUrl != null && imageUrl!.isNotEmpty)
              AspectRatio(
                aspectRatio: 2,
                child: Image.network(
                  imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: GuestColors.borderLight,
                    alignment: Alignment.center,
                    child: const Icon(Icons.image_not_supported_outlined),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: _fontFor(
                            font,
                            size: headlineSize,
                            weight: FontWeight.w800,
                            color: titleColor,
                          ),
                        ),
                      ),
                      if (unread)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: accent,
                          ),
                        ),
                    ],
                  ),
                  if (body.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      body,
                      style: _fontFor(
                        font,
                        size: 13.5,
                        weight: FontWeight.w500,
                        color: bodyColor,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: onTap,
                      style: FilledButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        cta,
                        style: _fontFor(
                          font,
                          size: 14,
                          weight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
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

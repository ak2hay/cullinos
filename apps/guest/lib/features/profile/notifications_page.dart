import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/orders/push_service.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

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
                  await ref
                      .read(guestApiProvider)
                      .markAllNotificationsRead();
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
                    return GuestSoftCard(
                      color: unread
                          ? GuestColors.primarySoft
                          : GuestColors.surface,
                      onTap: () async {
                        await ref
                            .read(guestApiProvider)
                            .markNotificationRead(n['id'].toString());
                        if (!context.mounted) return;
                        final orderId = data['orderId']?.toString();
                        final deepLink = data['deepLink']?.toString();
                        if (orderId != null && orderId.isNotEmpty) {
                          context.push('/orders/$orderId');
                          return;
                        }
                        if (deepLink != null && deepLink.isNotEmpty) {
                          GuestPushService.openDeepLink(deepLink);
                          await _load();
                          return;
                        }
                        final title = n['title']?.toString() ?? 'Notification';
                        final body = n['body']?.toString() ?? '';
                        await showModalBottomSheet<void>(
                          context: context,
                          backgroundColor: GuestColors.surface,
                          shape: const RoundedRectangleBorder(
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(24),
                            ),
                          ),
                          builder: (ctx) => Padding(
                            padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Center(
                                  child: Container(
                                    width: 40,
                                    height: 4,
                                    decoration: BoxDecoration(
                                      color: GuestColors.borderLight,
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 20),
                                Text(
                                  title,
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    color: GuestColors.ink,
                                  ),
                                ),
                                if (body.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Text(
                                    body,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      height: 1.4,
                                      color: GuestColors.muted,
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 20),
                                SizedBox(
                                  width: double.infinity,
                                  child: TextButton(
                                    onPressed: () => Navigator.pop(ctx),
                                    child: const Text('Close'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                        await _load();
                      },
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
                              color:
                                  unread ? Colors.white : GuestColors.muted,
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
                                        n['title']?.toString() ?? '',
                                        style: TextStyle(
                                          fontWeight: unread
                                              ? FontWeight.w800
                                              : FontWeight.w600,
                                          color: GuestColors.ink,
                                        ),
                                      ),
                                    ),
                                    if (unread)
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: GuestColors.primary,
                                        ),
                                      ),
                                  ],
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

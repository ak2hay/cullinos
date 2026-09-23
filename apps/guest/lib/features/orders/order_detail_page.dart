import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_gradient_card.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class OrderDetailPage extends ConsumerStatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends ConsumerState<OrderDetailPage> {
  Map<String, dynamic>? _order;
  String? _error;
  bool _loading = true;

  static const _steps = [
    ('confirmed', 'Order confirmed', 'We got your order'),
    ('preparing', 'Being prepared', 'Kitchen is on it'),
    ('ready', 'Ready', 'Pick up or out for delivery'),
    ('completed', 'Completed', 'Enjoy your meal 🎉'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final order = await ref.read(guestApiProvider).order(widget.orderId);
      setState(() => _order = order);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  int _stepIndex(String status) {
    final s = status.toLowerCase();
    if (s.contains('complet') || s.contains('deliver')) return 3;
    if (s.contains('ready') || s.contains('pickup')) return 2;
    if (s.contains('prepar')) return 1;
    if (s.contains('cancel') || s.contains('reject')) return -1;
    return 0;
  }

  Future<void> _reorder() async {
    try {
      final preview =
          await ref.read(guestApiProvider).reorderPreview(widget.orderId);
      final available =
          List<dynamic>.from(preview['available'] as List? ?? []);
      final unavailableCount =
          (preview['unavailableCount'] as num?)?.toInt() ?? 0;
      final outlet = Map<String, dynamic>.from(preview['outlet'] as Map);
      final org = Map<String, dynamic>.from(outlet['organization'] as Map);
      final cart = ref.read(cartProvider);
      cart.bindOutlet(
        orgId: preview['organizationId'] as String,
        outletId: preview['outletId'] as String,
        orgSlug: org['slug'] as String,
        outletSlug: outlet['slug'] as String,
        customerId: cart.customerId,
      );
      cart.replaceFromReorder(
        available
            .map((raw) {
              final a = Map<String, dynamic>.from(raw as Map);
              return CartLine(
                menuItemId: a['menuItemId'].toString(),
                name: a['name']?.toString() ?? '',
                unitPrice: (a['unitPrice'] as num?)?.toDouble() ?? 0,
                quantity: (a['quantity'] as num?)?.toInt() ?? 1,
                variantId: a['variantId']?.toString(),
              );
            })
            .toList(),
      );
      if (!mounted) return;
      if (unavailableCount > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$unavailableCount item(s) are currently unavailable.'),
            backgroundColor: GuestColors.primary,
          ),
        );
      }
      context.push('/o/${org['slug']}/${outlet['slug']}/checkout');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reorder failed: $e')),
      );
    }
  }

  Future<void> _rate() async {
    final outlet = _order?['outlet'];
    if (outlet is! Map) return;
    final outletId = outlet['id']?.toString();
    if (outletId == null) return;
    var rating = 5;
    final comment = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: GuestColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
        ),
        title: const Text('Rate your experience'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            StatefulBuilder(
              builder: (context, setLocal) {
                return Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (i) {
                    return IconButton(
                      onPressed: () => setLocal(() => rating = i + 1),
                      icon: Icon(
                        i < rating ? Icons.star_rounded : Icons.star_border,
                        color: GuestColors.star,
                        size: 32,
                      ),
                    );
                  }),
                );
              },
            ),
            const SizedBox(height: 8),
            TextField(
              controller: comment,
              decoration: const InputDecoration(
                labelText: 'Comment (optional)',
                hintText: 'Tell us what you thought…',
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: GuestColors.primary,
            ),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(guestApiProvider).createReview(
          outletId: outletId,
          rating: rating,
          orderId: widget.orderId,
          comment: comment.text.trim().isEmpty ? null : comment.text.trim(),
        );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thanks for your review! 🌟'),
          backgroundColor: GuestColors.primary,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: GuestColors.scaffold,
        appBar: AppBar(
          backgroundColor: GuestColors.scaffold,
          elevation: 0,
          leading: const GuestBackButton(fallbackPath: '/orders'),
        ),
        body: const GuestLoading(),
      );
    }
    if (_error != null || _order == null) {
      return Scaffold(
        backgroundColor: GuestColors.scaffold,
        appBar: AppBar(
          backgroundColor: GuestColors.scaffold,
          elevation: 0,
          leading: const GuestBackButton(fallbackPath: '/orders'),
        ),
        body: Center(child: Text(_error ?? 'Not found')),
      );
    }
    final o = _order!;
    final outletMap = o['outlet'] is Map
        ? Map<String, dynamic>.from(o['outlet'] as Map)
        : null;
    final outletName = outletMap?['name']?.toString();
    final delivery = o['delivery'] is Map
        ? Map<String, dynamic>.from(o['delivery'] as Map)
        : null;
    final items = List<dynamic>.from(o['items'] as List? ?? []);
    final status = o['status']?.toString() ?? '';
    final step = _stepIndex(status);
    final isCancelled = step == -1;

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        backgroundColor: GuestColors.scaffold,
        foregroundColor: GuestColors.ink,
        elevation: 0,
        leading: const GuestBackButton(fallbackPath: '/orders'),
        title: const Text(
          'Order Details',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: RefreshIndicator(
        color: GuestColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            GuestSpacing.page,
            8,
            GuestSpacing.page,
            32,
          ),
          children: [
            // ── Hero card ─────────────────────────────────────────────────
            GuestGradientCard(
              gradient: isCancelled
                  ? const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF6B7280), Color(0xFF4B5563)],
                    )
                  : GuestColors.heroTeal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (outletName != null) ...[
                    Row(
                      children: [
                        const Icon(Icons.storefront_rounded,
                            color: Colors.white70, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          outletName,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Order #${o['orderNumber'] ?? o['id']}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 20,
                          ),
                        ),
                      ),
                      // Status badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          status,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.payments_outlined,
                          color: Colors.white70, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        o['paymentStatus'] != null
                            ? 'Payment · ${o['paymentStatus']}'
                            : 'Payment pending',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  if (o['pickupCode'] != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius:
                            BorderRadius.circular(GuestSpacing.radiusSm),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.qr_code_rounded,
                              color: Colors.white, size: 16),
                          const SizedBox(width: 8),
                          Text(
                            'Pickup · ${o['pickupCode']}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text(
                    'Total  ₹${o['total']}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),

            // ── Progress tracker ──────────────────────────────────────────
            if (!isCancelled) ...[
              const SizedBox(height: 16),
              GuestSoftCard(
                child: Column(
                  children: List.generate(_steps.length, (i) {
                    final done = i <= step;
                    final current = i == step;
                    final label = _steps[i].$2;
                    final hint = _steps[i].$3;
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: done
                              ? GuestColors.primary
                              : GuestColors.borderLight,
                        ),
                        child: Icon(
                          done
                              ? Icons.check_rounded
                              : Icons.circle_outlined,
                          size: 16,
                          color:
                              done ? Colors.white : GuestColors.muted,
                        ),
                      ),
                      title: Text(
                        label,
                        style: TextStyle(
                          fontWeight: current || done
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color:
                              done ? GuestColors.ink : GuestColors.muted,
                        ),
                      ),
                      subtitle: Text(
                        hint,
                        style: TextStyle(
                          color: current
                              ? GuestColors.primaryDeep
                              : GuestColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ],

            if (isCancelled) ...[
              const SizedBox(height: 12),
              GuestSoftCard(
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFE4E6),
                        borderRadius:
                            BorderRadius.circular(GuestSpacing.radiusSm),
                      ),
                      child: const Icon(Icons.cancel_outlined,
                          color: GuestColors.popularRed, size: 18),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'This order was cancelled',
                      style: TextStyle(
                        color: GuestColors.popularRed,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            if (delivery != null) ...[
              const SizedBox(height: 12),
              GuestSoftCard(
                child: Row(
                  children: [
                    const Icon(Icons.delivery_dining_rounded,
                        color: GuestColors.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Delivery · ${delivery['status']}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600),
                          ),
                          if (delivery['address'] != null)
                            Text(
                              delivery['address'].toString(),
                              style: const TextStyle(
                                  color: GuestColors.muted, fontSize: 12),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // ── Items ─────────────────────────────────────────────────────
            const SizedBox(height: 16),
            const GuestSectionHeader(title: 'Items', emoji: '🍽️'),
            const SizedBox(height: 10),
            GuestSoftCard(
              child: Column(
                children: items.map((raw) {
                  final item = Map<String, dynamic>.from(raw as Map);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: GuestColors.primarySoft,
                            borderRadius:
                                BorderRadius.circular(GuestSpacing.radiusSm),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '×${item['quantity']}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: GuestColors.primaryDeep,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            item['name']?.toString() ?? '',
                            style:
                                const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        if (item['totalPrice'] != null)
                          Text(
                            '₹${item['totalPrice']}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: GuestColors.ink,
                            ),
                          ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 20),
            GuestPillButton(
              label: 'Reorder',
              icon: Icons.replay_rounded,
              onPressed: _reorder,
            ),
            const SizedBox(height: 10),
            GuestPillButton(
              label: 'Rate experience',
              secondary: true,
              icon: Icons.star_border_rounded,
              onPressed: _rate,
            ),
          ],
        ),
      ),
    );
  }
}

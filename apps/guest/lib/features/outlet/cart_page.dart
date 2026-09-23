import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';
import 'package:cullinos_guest/features/outlet/menu_utils.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_badges.dart';
import 'package:cullinos_guest/widgets/guest_dish_card.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_qty_stepper.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class CartPage extends ConsumerStatefulWidget {
  const CartPage({
    super.key,
    required this.orgSlug,
    required this.outletSlug,
  });

  final String orgSlug;
  final String outletSlug;

  @override
  ConsumerState<CartPage> createState() => _CartPageState();
}

class _CartPageState extends ConsumerState<CartPage> {
  List<Map<String, dynamic>> _upsell = [];
  final _notes = TextEditingController();

  @override
  void initState() {
    super.initState();
    _notes.text = ref.read(cartProvider).specialInstructions ?? '';
    _loadUpsell();
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _loadUpsell() async {
    try {
      final data = await ref
          .read(guestApiProvider)
          .storefront(widget.orgSlug, widget.outletSlug);
      final cats = parseStorefrontCategories(data);
      final cartIds =
          ref.read(cartProvider).lines.map((l) => l.menuItemId).toSet();
      final items = <Map<String, dynamic>>[];
      for (final c in cats) {
        for (final raw in (c['items'] as List? ?? [])) {
          final item = Map<String, dynamic>.from(raw as Map);
          if (!cartIds.contains(item['id']?.toString())) {
            items.add(item);
          }
        }
      }
      setState(() => _upsell = items.take(8).toList());
    } catch (_) {}
  }

  void _goCheckout() {
    final auth = ref.read(authControllerProvider);
    final path = '/o/${widget.orgSlug}/${widget.outletSlug}/checkout';
    if (!auth.isAuthenticated) {
      context.push('/login?next=${Uri.encodeComponent(path)}');
      return;
    }
    context.push(path);
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final packaging = cart.lines.isEmpty ? 0.0 : 10.0;
    final taxes = cart.subtotal * 0.05;
    final total = cart.subtotal + packaging + taxes;

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        leading: GuestBackButton(
          fallbackPath: '/o/${widget.orgSlug}/${widget.outletSlug}/menu',
        ),
        title: Column(
          children: [
            const Text('Your Cart'),
            Text(
              '${cart.itemCount} items${cart.restaurantName != null ? ' • ${cart.restaurantName}' : ''}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: GuestColors.muted,
              ),
            ),
          ],
        ),
        actions: [
          if (cart.lines.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton.icon(
                onPressed: () {
                  cart.clear();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cart cleared')),
                  );
                },
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('Clear Cart'),
                style: TextButton.styleFrom(
                  foregroundColor: GuestColors.primaryDeepOf(context),
                  backgroundColor: GuestColors.primarySoftOf(context),
                ),
              ),
            ),
        ],
      ),
      body: cart.lines.isEmpty
          ? GuestEmptyState(
              message: 'Your cart is empty',
              actionLabel: 'Browse menu',
              onAction: () => context.go(
                '/o/${widget.orgSlug}/${widget.outletSlug}/menu',
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                GuestSpacing.page,
                8,
                GuestSpacing.page,
                140,
              ),
              children: [
                GuestSoftCard(
                  child: Column(
                    children: [
                      InkWell(
                        onTap: () => context.go(
                          '/o/${widget.orgSlug}/${widget.outletSlug}',
                        ),
                        child: Row(
                          children: [
                            GuestNetworkImage(
                              url: cart.restaurantImageUrl,
                              width: 48,
                              height: 48,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    cart.restaurantName ?? 'Restaurant',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Text(
                                    cart.restaurantLocation ?? '',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: GuestColors.muted,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  const GuestOpenNowDot(),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded,
                                color: GuestColors.muted),
                          ],
                        ),
                      ),
                      const Divider(height: 24),
                      for (final line in cart.lines)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              GuestNetworkImage(
                                url: line.imageUrl,
                                width: 56,
                                height: 56,
                                borderRadius: BorderRadius.circular(10),
                                icon: Icons.lunch_dining_rounded,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 12,
                                          height: 12,
                                          decoration: BoxDecoration(
                                            border: Border.all(
                                              color: line.isVeg == true
                                                  ? const Color(0xFF16A34A)
                                                  : GuestColors.popularRed,
                                            ),
                                            borderRadius:
                                                BorderRadius.circular(2),
                                          ),
                                          child: Center(
                                            child: Container(
                                              width: 5,
                                              height: 5,
                                              decoration: BoxDecoration(
                                                color: line.isVeg == true
                                                    ? const Color(0xFF16A34A)
                                                    : GuestColors.popularRed,
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            line.name,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (line.variantLabel != null)
                                      Text(
                                        line.variantLabel!,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: GuestColors.muted,
                                        ),
                                      ),
                                    Text(
                                      formatInr(line.unitPrice),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                children: [
                                  GuestQtyStepper(
                                    quantity: line.quantity,
                                    compact: true,
                                    onChanged: (q) =>
                                        cart.setQtyByKey(line.key, q),
                                  ),
                                  IconButton(
                                    onPressed: () =>
                                        cart.removeByKey(line.key),
                                    icon: const Icon(
                                      Icons.delete_outline_rounded,
                                      size: 18,
                                      color: GuestColors.muted,
                                    ),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                GuestSoftCard(
                  onTap: () async {
                    final value = await showDialog<String>(
                      context: context,
                      builder: (ctx) {
                        final c = TextEditingController(text: _notes.text);
                        return AlertDialog(
                          title: const Text('Special instructions'),
                          content: TextField(
                            controller: c,
                            maxLines: 3,
                            decoration: const InputDecoration(
                              hintText: 'E.g. less spicy, no onion…',
                            ),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx),
                              child: const Text('Cancel'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(ctx, c.text),
                              child: const Text('Save'),
                            ),
                          ],
                        );
                      },
                    );
                    if (value != null) {
                      _notes.text = value;
                      cart.setSpecialInstructions(value);
                      setState(() {});
                    }
                  },
                  child: Row(
                    children: [
                      Icon(Icons.notes_rounded,
                          color: GuestColors.primaryOf(context)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _notes.text.isEmpty
                              ? 'Add special instructions (optional)'
                              : _notes.text,
                          style: TextStyle(
                            color: _notes.text.isEmpty
                                ? GuestColors.muted
                                : GuestColors.ink,
                          ),
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: GuestColors.muted),
                    ],
                  ),
                ),
                if (_upsell.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  GuestSectionHeader(
                    title: 'You might also like',
                    trailingLabel: 'See All',
                    onTrailing: () => context.push(
                      '/o/${widget.orgSlug}/${widget.outletSlug}/menu',
                    ),
                  ),
                  SizedBox(
                    height: 200,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _upsell.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                      itemBuilder: (_, i) {
                        final item = _upsell[i];
                        final price =
                            (item['price'] as num?)?.toDouble() ?? 0;
                        return GuestUpsellDishCard(
                          name: item['name']?.toString() ?? '',
                          priceLabel: formatInr(price),
                          imageUrl: item['imageUrl']?.toString(),
                          onAdd: () {
                            context.push(
                              '/o/${widget.orgSlug}/${widget.outletSlug}/item/${item['id']}',
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: GuestColors.borderLight,
                    borderRadius:
                        BorderRadius.circular(GuestSpacing.radiusMd),
                  ),
                  child: Column(
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.receipt_long_outlined, size: 18),
                          SizedBox(width: 6),
                          Text(
                            'Bill Summary',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _billRow('Items (${cart.itemCount})',
                          formatInr(cart.subtotal)),
                      _billRow('Restaurant Packaging Fee',
                          formatInr(packaging)),
                      _billRow('Taxes & Charges', formatInr(taxes)),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 10),
                        child: DashedDivider(),
                      ),
                      _billRow(
                        'Total Amount',
                        formatInr(total),
                        bold: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: cart.lines.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: GuestPillButton(
                  label: 'Proceed to Checkout',
                  subtitle: 'Choose delivery / dine in option',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        formatInr(total),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.arrow_forward_rounded,
                          color: Colors.white),
                    ],
                  ),
                  onPressed: _goCheckout,
                ),
              ),
            ),
    );
  }

  Widget _billRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
                color: bold ? GuestColors.ink : GuestColors.muted,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class DashedDivider extends StatelessWidget {
  const DashedDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 5.0;
        final count = (constraints.maxWidth / (dashWidth * 2)).floor();
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(
            count,
            (_) => Container(
              width: dashWidth,
              height: 1,
              color: GuestColors.border,
            ),
          ),
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';
import 'package:cullinos_guest/features/outlet/menu_utils.dart';
import 'package:cullinos_guest/widgets/guest_badges.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';
import 'package:cullinos_guest/widgets/guest_sticky_bars.dart';

class ProductDetailPage extends ConsumerStatefulWidget {
  const ProductDetailPage({
    super.key,
    required this.orgSlug,
    required this.outletSlug,
    required this.itemId,
  });

  final String orgSlug;
  final String outletSlug;
  final String itemId;

  @override
  ConsumerState<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends ConsumerState<ProductDetailPage> {
  Map<String, dynamic>? _item;
  Map<String, dynamic>? _outlet;
  Map<String, dynamic>? _org;
  bool _loading = true;
  String? _error;
  int _qty = 1;
  String? _selectedVariantId;
  final Map<String, Map<String, dynamic>> _selectedMods = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ref
          .read(guestApiProvider)
          .storefront(widget.orgSlug, widget.outletSlug);
      final cats = parseStorefrontCategories(data);
      final item = findMenuItem(cats, widget.itemId);
      final variants = List<Map<String, dynamic>>.from(
        (item?['variants'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map)),
      );
      setState(() {
        _item = item;
        _outlet = data['outlet'] is Map
            ? Map<String, dynamic>.from(data['outlet'] as Map)
            : null;
        _org = data['organization'] is Map
            ? Map<String, dynamic>.from(data['organization'] as Map)
            : null;
        _selectedVariantId =
            variants.isEmpty ? null : variants.first['id']?.toString();
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  double get _unitPrice {
    final item = _item;
    if (item == null) return 0;
    double price = (item['price'] as num?)?.toDouble() ?? 0;
    final variants = List<Map<String, dynamic>>.from(
      (item['variants'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)),
    );
    if (_selectedVariantId != null) {
      final v = variants.firstWhere(
        (e) => e['id']?.toString() == _selectedVariantId,
        orElse: () => <String, dynamic>{},
      );
      if (v['price'] != null) price = (v['price'] as num).toDouble();
    }
    for (final m in _selectedMods.values) {
      price += (m['price'] as num?)?.toDouble() ?? 0;
    }
    return price;
  }

  void _addToCart() {
    final item = _item;
    if (item == null) return;
    final variants = List<Map<String, dynamic>>.from(
      (item['variants'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)),
    );
    String? variantLabel;
    if (_selectedVariantId != null) {
      final v = variants.firstWhere(
        (e) => e['id']?.toString() == _selectedVariantId,
        orElse: () => <String, dynamic>{},
      );
      variantLabel = v['name']?.toString();
    }
    final mods = _selectedMods.values
        .map((m) => {
              'id': m['id'],
              'name': m['name'],
              'price': m['price'],
            })
        .toList();
    var display = item['name']?.toString() ?? '';
    if (variantLabel != null) display = '$display ($variantLabel)';

    final cart = ref.read(cartProvider);
    final outlet = _outlet;
    final org = _org;
    if (outlet != null && org != null) {
      cart.bindOutlet(
        orgId: org['id']?.toString() ?? cart.orgId ?? '',
        outletId: outlet['id']?.toString() ?? cart.outletId ?? '',
        orgSlug: widget.orgSlug,
        outletSlug: widget.outletSlug,
        restaurantName: outlet['name']?.toString() ?? org['name']?.toString(),
        restaurantImageUrl:
            outlet['coverImageUrl']?.toString() ?? org['logoUrl']?.toString(),
        restaurantLocation: [
          outlet['city'],
          outlet['area'],
        ].where((e) => e != null && e.toString().isNotEmpty).join(', '),
      );
    }

    cart.addItem(
      menuItemId: item['id'].toString(),
      name: display,
      unitPrice: _unitPrice,
      variantId: _selectedVariantId,
      variantLabel: variantLabel,
      modifiers: mods.isEmpty ? null : mods,
      quantity: _qty,
      imageUrl: item['imageUrl']?.toString(),
      isVeg: item['isVeg'] == true,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added ${item['name']} to cart'),
        action: SnackBarAction(
          label: 'View Cart',
          onPressed: () => context.push(
            '/o/${widget.orgSlug}/${widget.outletSlug}/cart',
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: GuestLoading());
    }
    if (_error != null || _item == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(_error ?? 'Item not found')),
      );
    }

    final item = _item!;
    final variants = List<Map<String, dynamic>>.from(
      (item['variants'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)),
    );
    final groups = List<Map<String, dynamic>>.from(
      (item['modifierGroups'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)),
    );
    final isVeg = item['isVeg'] == true;
    final desc = item['description']?.toString() ?? '';
    final outlet = _outlet;
    final org = _org;
    final restaurantName =
        outlet?['name']?.toString() ?? org?['name']?.toString() ?? 'Restaurant';

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Stack(
                    children: [
                      GuestNetworkImage(
                        url: item['imageUrl']?.toString(),
                        height: 280,
                        width: double.infinity,
                        borderRadius: const BorderRadius.vertical(
                          bottom: Radius.circular(24),
                        ),
                        icon: Icons.lunch_dining_rounded,
                      ),
                      SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              _roundIcon(Icons.arrow_back_ios_new_rounded,
                                  () => context.pop()),
                              const Spacer(),
                              _roundIcon(Icons.favorite_border_rounded, () {}),
                              const SizedBox(width: 8),
                              _roundIcon(Icons.ios_share_rounded, () {
                                final name =
                                    _item?['name']?.toString() ?? 'Dish';
                                final url =
                                    'https://guest.cullinos.com/o/${widget.orgSlug}/${widget.outletSlug}/item/${widget.itemId}';
                                Share.share('Try $name on Cullinos\n$url');
                              }),
                            ],
                          ),
                        ),
                      ),
                      const Positioned(
                        left: 16,
                        bottom: 16,
                        child: GuestBadge(
                          label: 'Bestseller',
                          tone: GuestBadgeTone.dark,
                          icon: Icons.eco_rounded,
                        ),
                      ),
                    ],
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    GuestSpacing.page,
                    20,
                    GuestSpacing.page,
                    120,
                  ),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              item['name']?.toString() ?? '',
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: GuestColors.primarySoftOf(context),
                              borderRadius:
                                  BorderRadius.circular(GuestSpacing.radiusSm),
                            ),
                            child: Text(
                              formatInr(_unitPrice),
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          desc,
                          style: const TextStyle(
                            color: GuestColors.muted,
                            height: 1.45,
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        children: [
                          _metaChip(
                            isVeg ? Icons.circle : Icons.circle,
                            isVeg ? 'Veg' : 'Non-Veg',
                            isVeg
                                ? const Color(0xFF16A34A)
                                : GuestColors.popularRed,
                          ),
                          if (item['calories'] != null)
                            _metaChip(
                              Icons.local_fire_department_rounded,
                              '${item['calories']} kcal',
                              GuestColors.coralDeep,
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      GuestSoftCard(
                        child: Row(
                          children: [
                            GuestNetworkImage(
                              url: org?['logoUrl']?.toString() ??
                                  outlet?['coverImageUrl']?.toString(),
                              width: 44,
                              height: 44,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    restaurantName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Text(
                                    (outlet?['cuisineTypes'] as List?)
                                            ?.join(', ') ??
                                        'Restaurant',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: GuestColors.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: () => context.go(
                                '/o/${widget.orgSlug}/${widget.outletSlug}',
                              ),
                              style: TextButton.styleFrom(
                                backgroundColor: GuestColors.primarySoftOf(context),
                                foregroundColor: GuestColors.primaryOf(context),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text('View'),
                                  Icon(Icons.arrow_forward_rounded, size: 16),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (variants.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        const Text(
                          'Select Size',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Required',
                          style: TextStyle(
                            fontSize: 12,
                            color: GuestColors.muted,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            for (final v in variants)
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: _SizeCard(
                                    label: v['name']?.toString() ?? '',
                                    price: formatInr(
                                      (v['price'] as num?)?.toDouble() ?? 0,
                                    ),
                                    selected: _selectedVariantId ==
                                        v['id']?.toString(),
                                    onTap: () => setState(
                                      () => _selectedVariantId =
                                          v['id']?.toString(),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                      if (groups.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        const Text(
                          'Add-ons',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Optional',
                          style: TextStyle(
                            fontSize: 12,
                            color: GuestColors.muted,
                          ),
                        ),
                        const SizedBox(height: 8),
                        GuestSoftCard(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              for (final g in groups)
                                ...(g['modifiers'] as List? ?? []).map((raw) {
                                  final m =
                                      Map<String, dynamic>.from(raw as Map);
                                  final id = m['id']?.toString() ?? '';
                                  final selected =
                                      _selectedMods.containsKey(id);
                                  return CheckboxListTile(
                                    value: selected,
                                    controlAffinity:
                                        ListTileControlAffinity.leading,
                                    activeColor: GuestColors.primaryOf(context),
                                    title: Text(m['name']?.toString() ?? ''),
                                    secondary: Text(
                                      formatInr(
                                        (m['price'] as num?)?.toDouble() ?? 0,
                                      ),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    onChanged: (val) {
                                      setState(() {
                                        if (val == true) {
                                          _selectedMods[id] = m;
                                        } else {
                                          _selectedMods.remove(id);
                                        }
                                      });
                                    },
                                  );
                                }),
                            ],
                          ),
                        ),
                      ],
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: GuestColors.primarySoftOf(context),
                            borderRadius:
                                BorderRadius.circular(GuestSpacing.radiusMd),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.soup_kitchen_outlined,
                                      color: GuestColors.primaryOf(context), size: 18),
                                  const SizedBox(width: 6),
                                  Text(
                                    "Chef's Note",
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: GuestColors.primaryDeepOf(context),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                desc,
                                style: TextStyle(
                                  fontStyle: FontStyle.italic,
                                  color: GuestColors.ink.withValues(alpha: 0.8),
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _ValueProp(
                            icon: Icons.restaurant_rounded,
                            label: 'Freshly\nPrepared',
                          ),
                          _ValueProp(
                            icon: Icons.verified_user_outlined,
                            label: 'Hygienic\n& Safe',
                          ),
                          _ValueProp(
                            icon: Icons.eco_outlined,
                            label: 'Quality\nIngredients',
                          ),
                          _ValueProp(
                            icon: Icons.favorite_outline_rounded,
                            label: 'Loved by\nCustomers',
                          ),
                        ],
                      ),
                    ]),
                  ),
                ),
              ],
            ),
          ),
          GuestAddToCartBar(
            quantity: _qty,
            onQuantityChanged: (q) => setState(() => _qty = q),
            totalLabel: formatInr(_unitPrice * _qty),
            onAdd: _addToCart,
          ),
        ],
      ),
    );
  }

  Widget _roundIcon(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 18, color: GuestColors.ink),
        ),
      ),
    );
  }

  Widget _metaChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: GuestColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: GuestColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _SizeCard extends StatelessWidget {
  const _SizeCard({
    required this.label,
    required this.price,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String price;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: selected ? GuestColors.primarySoftOf(context) : GuestColors.surface,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
          border: Border.all(
            color: selected ? GuestColors.primaryOf(context) : GuestColors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: selected ? GuestColors.primaryDeepOf(context) : GuestColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              price,
              style: const TextStyle(fontSize: 12, color: GuestColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _ValueProp extends StatelessWidget {
  const _ValueProp({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: GuestColors.primaryOf(context), size: 22),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 10,
            color: GuestColors.muted,
            height: 1.2,
          ),
        ),
      ],
    );
  }
}

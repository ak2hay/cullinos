import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';
import 'package:cullinos_guest/features/outlet/menu_utils.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';
import 'package:cullinos_guest/widgets/guest_sticky_bars.dart';

class MenuPage extends ConsumerStatefulWidget {
  const MenuPage({
    super.key,
    required this.orgSlug,
    required this.outletSlug,
  });

  final String orgSlug;
  final String outletSlug;

  @override
  ConsumerState<MenuPage> createState() => _MenuPageState();
}

class _MenuPageState extends ConsumerState<MenuPage> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _categories = [];
  bool _loading = true;
  String? _error;
  /// all | veg | nonveg
  String _dietFilter = 'all';
  String? _selectedCategoryId; // null = show all
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ─── Data loading ──────────────────────────────────────────────────────────

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(guestApiProvider)
          .storefront(widget.orgSlug, widget.outletSlug);
      final cats = parseStorefrontCategories(data);
      if (!mounted) return;
      setState(() => _categories = cats);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  List<Map<String, dynamic>> get _displayCategories {
    var cats = _categories;

    // Category filter
    if (_selectedCategoryId != null) {
      cats = cats
          .where((c) => c['id']?.toString() == _selectedCategoryId)
          .toList();
    }

    // Map each category — apply veg + search filters to items
    cats = cats.map((cat) {
      var items = List<Map<String, dynamic>>.from(
        (cat['items'] as List? ?? [])
            .map((i) => Map<String, dynamic>.from(i as Map)),
      );
      if (_dietFilter == 'veg') {
        items = items.where((i) => i['isVeg'] == true).toList();
      } else if (_dietFilter == 'nonveg') {
        items = items.where((i) => i['isVeg'] != true).toList();
      }
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        items = items
            .where((i) =>
                (i['name']?.toString().toLowerCase() ?? '').contains(q) ||
                (i['description']?.toString().toLowerCase() ?? '')
                    .contains(q))
            .toList();
      }
      return {...cat, 'items': items};
    }).toList();

    // Drop empty categories
    return cats
        .where((c) => (c['items'] as List? ?? []).isNotEmpty)
        .toList();
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: _buildAppBar(),
      body: _loading
          ? const GuestLoading()
          : _error != null
              ? Center(child: Text(_error!))
              : _categories.isEmpty
                  ? const GuestEmptyState(
                      message: 'Menu is empty right now.',
                      icon: Icons.restaurant_menu_outlined,
                    )
                  : _buildBody(),
      bottomNavigationBar: cart.lines.isEmpty
          ? null
          : GuestCartStickyBar(
              itemCount: cart.itemCount,
              totalLabel: '₹${cart.subtotal.toStringAsFixed(0)}',
              onViewCart: () => context.push(
                  '/o/${widget.orgSlug}/${widget.outletSlug}/cart'),
            ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: GuestColors.surface,
      surfaceTintColor: Colors.transparent,
      leading: const GuestBackButton(),
      titleSpacing: 0,
      title: const Text(
        'Menu',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: GuestColors.ink,
          fontSize: 18,
        ),
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final entry in const [
                ('all', 'All'),
                ('veg', 'Veg'),
                ('nonveg', 'Non-veg'),
              ])
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: GestureDetector(
                    onTap: () => setState(() => _dietFilter = entry.$1),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _dietFilter == entry.$1
                            ? const Color(0xFFE8F8EF)
                            : GuestColors.surface,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: _dietFilter == entry.$1
                              ? const Color(0xFF1B8A4A)
                              : GuestColors.border,
                        ),
                      ),
                      child: Text(
                        entry.$2,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _dietFilter == entry.$1
                              ? const Color(0xFF1B8A4A)
                              : GuestColors.muted,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(
          height: 1,
          color: GuestColors.border,
        ),
      ),
    );
  }

  Widget _buildBody() {
    final display = _displayCategories;

    return Column(
      children: [
        // ── Search field ──────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(
              GuestSpacing.page, 12, GuestSpacing.page, 0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search dishes…',
              hintStyle:
                  const TextStyle(color: GuestColors.muted, fontSize: 14),
              prefixIcon: const Icon(Icons.search_rounded,
                  color: GuestColors.muted, size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close_rounded,
                          color: GuestColors.muted, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              filled: true,
              fillColor: GuestColors.surface,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(GuestSpacing.radiusMd),
                borderSide: const BorderSide(color: GuestColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(GuestSpacing.radiusMd),
                borderSide: const BorderSide(color: GuestColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(GuestSpacing.radiusMd),
                borderSide: BorderSide(
                    color: GuestColors.primaryOf(context), width: 1.5),
              ),
            ),
            onChanged: (v) => setState(() => _searchQuery = v.trim()),
          ),
        ),
        // ── Category chips ────────────────────────────────────────────
        if (_categories.isNotEmpty) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: GuestSpacing.page),
              itemCount: _categories.length + 1, // +1 for "All"
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                if (i == 0) {
                  final isAll = _selectedCategoryId == null;
                  return _CategoryChip(
                    label: 'All',
                    selected: isAll,
                    onTap: () =>
                        setState(() => _selectedCategoryId = null),
                  );
                }
                final cat = _categories[i - 1];
                final catId = cat['id']?.toString();
                final isSelected = _selectedCategoryId == catId;
                return _CategoryChip(
                  label: cat['name']?.toString() ?? 'Category',
                  selected: isSelected,
                  onTap: () =>
                      setState(() => _selectedCategoryId = catId),
                );
              },
            ),
          ),
        ],
        const SizedBox(height: 8),
        // ── Item list ─────────────────────────────────────────────────
        Expanded(
          child: display.isEmpty
              ? const GuestEmptyState(
                  message: 'No items match your filters.',
                  icon: Icons.search_off_rounded,
                )
              : RefreshIndicator(
                  color: GuestColors.primaryOf(context),
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(
                        GuestSpacing.page, 4, GuestSpacing.page, 120),
                    itemCount: display.length,
                    itemBuilder: (_, catIdx) {
                      final cat = display[catIdx];
                      final items = List<Map<String, dynamic>>.from(
                        (cat['items'] as List? ?? [])
                            .map((i) =>
                                Map<String, dynamic>.from(i as Map)),
                      );
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding:
                                const EdgeInsets.only(top: 16, bottom: 10),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    cat['name']?.toString() ?? 'Category',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(
                                          fontWeight: FontWeight.w800,
                                          color: GuestColors.ink,
                                        ),
                                  ),
                                ),
                                Text(
                                  '${items.length} item${items.length == 1 ? '' : 's'}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: GuestColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          for (final item in items)
                            _buildItemRow(item),
                        ],
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  // ─── Item row ──────────────────────────────────────────────────────────────

  Widget _buildItemRow(Map<String, dynamic> item) {
    final price = (item['price'] as num?)?.toDouble() ?? 0.0;
    final isVeg = item['isVeg'] == true;
    final name = item['name']?.toString() ?? '';
    final desc = item['description']?.toString() ?? '';
    final imageUrl = item['imageUrl']?.toString();
    final cart = ref.read(cartProvider);

    // Check quantity in cart
    final cartQty = cart.lines
        .where((l) => l.menuItemId == item['id']?.toString())
        .fold<int>(0, (s, l) => s + l.quantity);

    return GestureDetector(
      onTap: () => context.push(
        '/o/${widget.orgSlug}/${widget.outletSlug}/item/${item['id']}',
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: GuestColors.surface,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          boxShadow: GuestSpacing.softShadow(),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            GuestNetworkImage(
              url: imageUrl?.isNotEmpty == true ? imageUrl : null,
              width: 80,
              height: 80,
              borderRadius:
                  BorderRadius.circular(GuestSpacing.radiusSm),
              icon: Icons.lunch_dining_rounded,
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Veg indicator + name
                  Row(
                    children: [
                      if (isVeg)
                        Container(
                          width: 14,
                          height: 14,
                          margin: const EdgeInsets.only(right: 6),
                          decoration: BoxDecoration(
                            border: Border.all(
                                color: const Color(0xFF1B8A4A), width: 1.5),
                            borderRadius: BorderRadius.circular(2),
                          ),
                          child: Center(
                            child: Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: Color(0xFF1B8A4A),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: GuestColors.ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (desc.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      desc,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: GuestColors.muted,
                        height: 1.3,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '₹${price.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: GuestColors.ink,
                          ),
                        ),
                      ),
                      // ADD button
                      GestureDetector(
                        onTap: () => _handleAdd(item, price),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: cartQty > 0
                                ? GuestColors.primaryOf(context)
                                : Colors.transparent,
                            borderRadius:
                                BorderRadius.circular(GuestSpacing.radiusSm),
                            border: Border.all(color: GuestColors.primaryOf(context)),
                          ),
                          child: Text(
                            cartQty > 0 ? '$cartQty in cart' : 'ADD +',
                            style: TextStyle(
                              color: cartQty > 0
                                  ? Colors.white
                                  : GuestColors.primaryOf(context),
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
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

  // ─── Handle ADD ────────────────────────────────────────────────────────────

  void _handleAdd(Map<String, dynamic> item, double price) {
    final variants = List<Map<String, dynamic>>.from(
      (item['variants'] as List? ?? [])
          .map((v) => Map<String, dynamic>.from(v as Map)),
    );
    final groups = List<Map<String, dynamic>>.from(
      (item['modifierGroups'] as List? ?? [])
          .map((g) => Map<String, dynamic>.from(g as Map)),
    );

    if (variants.isEmpty && groups.isEmpty) {
      // Simple item — add directly and show feedback
      ref.read(cartProvider).addItem(
            menuItemId: item['id'].toString(),
            name: item['name']?.toString() ?? '',
            unitPrice: price,
            imageUrl: item['imageUrl']?.toString(),
            isVeg: item['isVeg'] as bool?,
          );
      setState(() {}); // Refresh to update cart qty display
    } else {
      // Has variants or modifiers — navigate to detail
      context.push(
        '/o/${widget.orgSlug}/${widget.outletSlug}/item/${item['id']}',
      );
    }
  }
}

// ─── Category chip ─────────────────────────────────────────────────────────────

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? GuestColors.primaryOf(context) : GuestColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? GuestColors.primaryOf(context) : GuestColors.border,
          ),
          boxShadow: selected
              ? GuestSpacing.softShadow(color: GuestColors.primaryOf(context))
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : GuestColors.ink,
          ),
        ),
      ),
    );
  }
}

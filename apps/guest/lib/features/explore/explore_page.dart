import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/location/guest_location_controller.dart';
import 'package:cullinos_guest/widgets/guest_banner_carousel.dart';
import 'package:cullinos_guest/widgets/guest_brand_wordmark.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_filter_chips.dart';
import 'package:cullinos_guest/widgets/guest_location_chip.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';
import 'package:cullinos_guest/widgets/guest_restaurant_card.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class ExplorePage extends ConsumerStatefulWidget {
  const ExplorePage({super.key});

  @override
  ConsumerState<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends ConsumerState<ExplorePage> {
  final _search = TextEditingController();
  List<dynamic> _outlets = [];
  List<dynamic> _offers = [];
  List<Map<String, dynamic>> _banners = [];
  List<Map<String, dynamic>> _sections = [];
  List<Map<String, dynamic>> _specials = [];
  List<dynamic> _recentOrders = [];
  List<dynamic> _favorites = [];
  List<dynamic> _memberships = [];
  bool _loading = true;
  /// Soft refresh while keeping chrome/list visible (filter apply, pull-to-refresh).
  bool _refreshing = false;
  String? _error;
  String? _selectedCuisine;
  bool _showAllPopular = false;
  String? _resultSummary;

  // ── Filter state ────────────────────────────────────────────────────────────
  bool _initialized = false;
  bool _dineIn = false;
  bool _takeaway = false;
  bool _delivery = false;
  bool _offersOnly = false;
  bool _veg = false;
  double _radiusKm = 10.0;

  @override
  void initState() {
    super.initState();
    // _load() called in didChangeDependencies after reading query params
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      _initialized = true;
      _readQueryParams();
      _load();
    }
  }

  void _readQueryParams() {
    try {
      final uri = GoRouterState.of(context).uri;
      final params = uri.queryParameters;
      final mode = params['mode'];
      final cuisine = params['cuisine'];
      if (mode == 'dine_in') _dineIn = true;
      if (mode == 'takeaway') _takeaway = true;
      if (mode == 'delivery') _delivery = true;
      if (mode == 'offers') _offersOnly = true;
      if (cuisine != null && cuisine.isNotEmpty) {
        _selectedCuisine = cuisine;
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool soft = false}) async {
    if (!mounted) return;
    final keepChrome = soft || (!_loading && _outlets.isNotEmpty);
    setState(() {
      if (keepChrome) {
        _refreshing = true;
      } else {
        _loading = true;
      }
      _error = null;
    });
    try {
      final locCtrl = ref.read(guestLocationProvider);
      if (!locCtrl.state.hasCoords) {
        await locCtrl.detectAuto();
      }
      final loc = locCtrl.state;
      final lat = loc.lat;
      final lng = loc.lng;

      final api = ref.read(guestApiProvider);
      final searchQ = _search.text.trim();
      final nearby = await api.nearby(
        lat: lat,
        lng: lng,
        q: searchQ,
        cuisine: _selectedCuisine,
        radiusKm: _radiusKm,
        dineIn: _dineIn ? true : null,
        takeaway: _takeaway ? true : null,
        delivery: _delivery ? true : null,
        veg: _veg ? true : null,
        offersOnly: _offersOnly ? true : null,
      );
      final nearbyOutlets = List<dynamic>.from(nearby['outlets'] as List? ?? []);
      final offers = await api.offers(lat: lat, lng: lng);
      List<Map<String, dynamic>> specials = [];
      try {
        final specialsRes = await api.specials(lat: lat, lng: lng);
        specials = List<dynamic>.from(specialsRes['specials'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {}
      List<Map<String, dynamic>> banners = [];
      try {
        final bannerRes = await api.banners(lat: lat, lng: lng);
        banners = List<dynamic>.from(bannerRes['banners'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {}
      List<Map<String, dynamic>> sections = [];
      try {
        final sectionRes = await api.discoverSections();
        sections = List<dynamic>.from(sectionRes['sections'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {}
      List<dynamic> recent = [];
      List<dynamic> favs = [];
      List<dynamic> wallets = [];
      final authed = ref.read(authControllerProvider).isAuthenticated;
      if (authed) {
        try {
          recent = await api.orders();
        } catch (_) {}
        try {
          favs = await api.favoriteOutlets();
        } catch (_) {}
        try {
          wallets = await api.memberships();
        } catch (_) {}
      }
      if (!mounted) return;
      final count = nearbyOutlets.length;
      setState(() {
        _outlets = nearbyOutlets;
        _offers = List<dynamic>.from(offers['offers'] as List? ?? []);
        _banners = banners;
        _sections = sections;
        _specials = specials;
        _recentOrders = recent.take(5).toList();
        _favorites = favs.take(8).toList();
        _memberships = wallets.take(3).toList();
        _resultSummary = count == 1 ? '1 place' : '$count places';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = _friendlyLoadError(e));
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _refreshing = false;
        });
      }
    }
  }

  void _syncFilterQuery() {
    try {
      String? mode;
      if (_dineIn) {
        mode = 'dine_in';
      } else if (_takeaway) {
        mode = 'takeaway';
      } else if (_delivery) {
        mode = 'delivery';
      } else if (_offersOnly) {
        mode = 'offers';
      }
      final params = <String, String>{};
      if (mode != null) params['mode'] = mode;
      if (_selectedCuisine != null && _selectedCuisine!.isNotEmpty) {
        params['cuisine'] = _selectedCuisine!;
      }
      final qs = params.isEmpty
          ? ''
          : '?${params.entries.map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}').join('&')}';
      context.go('/explore$qs');
    } catch (_) {}
  }

  String _friendlyLoadError(Object e) {
    final text = e.toString().toLowerCase();
    if (text.contains('timeout') ||
        text.contains('timed out') ||
        text.contains('connection') ||
        text.contains('socket') ||
        text.contains('network')) {
      return 'Cannot reach Cullinos servers. Check your internet, or try again later.';
    }
    return 'Could not load nearby places. Pull to retry.';
  }

  List<Map<String, dynamic>> _outletsForSection(Map<String, dynamic> section) {
    final type = section['type']?.toString() ?? 'outlets';
    final payload = section['payload'] is Map
        ? Map<String, dynamic>.from(section['payload'] as Map)
        : <String, dynamic>{};
    final all =
        _outlets.map((e) => Map<String, dynamic>.from(e as Map)).toList();

    if (type == 'cuisine') {
      final cuisine =
          (payload['cuisine'] ?? payload['tag'] ?? '').toString().toLowerCase();
      if (cuisine.isEmpty) return all.take(8).toList();
      return all
          .where((o) {
            final tags = (o['cuisineTags'] as List?)
                    ?.map((t) => t.toString().toLowerCase())
                    .toList() ??
                const <String>[];
            return tags.contains(cuisine);
          })
          .take(8)
          .toList();
    }
    if (type == 'manual_outlets') {
      final ids = (payload['outletIds'] as List?)
              ?.map((e) => e.toString())
              .toSet() ??
          <String>{};
      if (ids.isEmpty) return all.take(8).toList();
      return all
          .where((o) => ids.contains(o['id']?.toString()))
          .take(8)
          .toList();
    }
    return all.take(8).toList();
  }

  void _openBanner(Map<String, dynamic> banner) {
    final type = banner['linkType']?.toString() ?? 'none';
    final payload = banner['linkPayload'] is Map
        ? Map<String, dynamic>.from(banner['linkPayload'] as Map)
        : <String, dynamic>{};

    if (type == 'outlet' || type == 'storefront') {
      final orgSlug = payload['orgSlug']?.toString() ??
          payload['organizationSlug']?.toString();
      final outletSlug = payload['outletSlug']?.toString();
      if (orgSlug != null && outletSlug != null) {
        context.push('/o/$orgSlug/$outletSlug');
        return;
      }
    }
    if (type == 'order') {
      final orderId = payload['orderId']?.toString();
      if (orderId != null) {
        context.push('/orders/$orderId');
        return;
      }
    }
    if (type == 'url') {
      final path = payload['path']?.toString();
      if (path != null && path.startsWith('/')) {
        context.push(path);
      }
    }
  }

  void _openFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: GuestColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _FilterSheet(
        dineIn: _dineIn,
        takeaway: _takeaway,
        delivery: _delivery,
        offersOnly: _offersOnly,
        veg: _veg,
        radiusKm: _radiusKm,
        onApply: (result) {
          setState(() {
            _dineIn = result.dineIn;
            _takeaway = result.takeaway;
            _delivery = result.delivery;
            _offersOnly = result.offersOnly;
            _veg = result.veg;
            _radiusKm = result.radiusKm;
          });
          Navigator.pop(ctx);
          _syncFilterQuery();
          _load(soft: true);
        },
      ),
    );
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  List<String> get _uniqueCuisines {
    final seen = <String>{};
    for (final raw in _outlets) {
      final o = Map<String, dynamic>.from(raw as Map);
      final tags = (o['cuisineTags'] as List?) ?? [];
      for (final t in tags) {
        final s = t.toString().trim();
        if (s.isNotEmpty) seen.add(s);
      }
    }
    return seen.take(10).toList();
  }

  List<Map<String, dynamic>> get _filteredOutlets {
    final all =
        _outlets.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    if (_selectedCuisine == null) return all;
    return all.where((o) {
      final tags = (o['cuisineTags'] as List?)
              ?.map((t) => t.toString().toLowerCase())
              .toList() ??
          [];
      return tags.contains(_selectedCuisine!.toLowerCase());
    }).toList();
  }

  bool get _hasActiveFilters =>
      _dineIn || _takeaway || _delivery || _offersOnly || _veg || _radiusKm != 10.0;

  // ─── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      body: SafeArea(
        child: _loading
            ? const GuestLoading()
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(GuestSpacing.page),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_error!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          TextButton(
                              onPressed: () => _load(),
                              child: const Text('Retry')),
                        ],
                      ),
                    ),
                  )
                : Stack(
                    children: [
                      RefreshIndicator(
                        color: GuestColors.primary,
                        onRefresh: () => _load(soft: true),
                        child: CustomScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          slivers: [
                            SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(
                                    GuestSpacing.page, 16, GuestSpacing.page, 0),
                                child: _buildTopHeader(auth),
                              ),
                            ),
                            SliverPadding(
                              padding: const EdgeInsets.fromLTRB(
                                  GuestSpacing.page, 16, GuestSpacing.page, 110),
                              sliver: SliverList(
                                delegate: SliverChildListDelegate([
                                  _buildSearchRow(),
                                  if (_resultSummary != null) ...[
                                    const SizedBox(height: 10),
                                    Text(
                                      _resultSummary!,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: GuestColors.muted,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 20),
                                  _buildCategorySquares(),
                                  const SizedBox(height: 20),
                                  _buildPromo(),
                                  if (_filteredOutlets.isNotEmpty) ...[
                                    const SizedBox(height: 24),
                                    _buildPopularNearYou(),
                                  ],
                                  if (_specials.isNotEmpty) ...[
                                    const SizedBox(height: 24),
                                    _buildSpecialDishes(),
                                  ],
                                  if (_uniqueCuisines.isNotEmpty) ...[
                                    const SizedBox(height: 24),
                                    _buildCuisinesForMood(),
                                  ],
                                  for (final section in _sections)
                                    Builder(builder: (ctx) {
                                      final items = _outletsForSection(section);
                                      if (items.isEmpty) {
                                        return const SizedBox.shrink();
                                      }
                                      return _buildSectionRow(section, items);
                                    }),
                                  if (auth.isAuthenticated) ...[
                                    if (_recentOrders.isNotEmpty) ...[
                                      const SizedBox(height: 24),
                                      _buildRecentOrders(),
                                    ],
                                    if (_favorites.isNotEmpty) ...[
                                      const SizedBox(height: 16),
                                      _buildFavorites(),
                                    ],
                                    const SizedBox(height: 16),
                                    _buildLoyalty(),
                                  ],
                                ]),
                              ),
                            ),
                            if (_outlets.isEmpty)
                              const SliverFillRemaining(
                                hasScrollBody: false,
                                child: GuestEmptyState(
                                  message:
                                      'No listed outlets nearby yet. Scan a table QR to order.',
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (_refreshing)
                        const Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          child: LinearProgressIndicator(
                            minHeight: 2,
                            color: GuestColors.primary,
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  Widget _buildTopHeader(AuthState auth) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(child: GuestBrandWordmark(compact: true)),
            const SizedBox(width: 8),
            GuestLocationChip(onChanged: _load),
            const SizedBox(width: 8),
            _RoundIconButton(
              icon: Icons.notifications_none_rounded,
              onTap: () => context.push('/notifications'),
            ),
          ],
        ),
        const SizedBox(height: 3),
        const Text(
          'Good Food. Great People.',
          style: TextStyle(
            fontSize: 12,
            color: GuestColors.muted,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Explore',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: GuestColors.ink,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Discover great food around you',
          style: TextStyle(
            fontSize: 14,
            color: GuestColors.muted,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  // ─── Search row ────────────────────────────────────────────────────────────

  Widget _buildSearchRow() {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _search,
            onSubmitted: (_) => _load(),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search restaurants, cuisine…',
              hintStyle:
                  const TextStyle(color: GuestColors.muted, fontSize: 14),
              prefixIcon: const Icon(Icons.search_rounded,
                  color: GuestColors.muted, size: 22),
              filled: true,
              fillColor: GuestColors.surface,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
                borderSide: const BorderSide(color: GuestColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
                borderSide: const BorderSide(color: GuestColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
                borderSide:
                    const BorderSide(color: GuestColors.primary, width: 1.5),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Stack(
          clipBehavior: Clip.none,
          children: [
            _RoundIconButton(
              icon: Icons.tune_rounded,
              onTap: _openFilterSheet,
              active: _hasActiveFilters,
            ),
            if (_hasActiveFilters)
              Positioned(
                right: 2,
                top: 2,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: GuestColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  // ─── Category squares ──────────────────────────────────────────────────────

  Widget _buildCategorySquares() {
    final cats = <(String, IconData, Color)>[
      ('All', Icons.grid_view_rounded, GuestColors.primary),
      ('Indian', Icons.soup_kitchen_outlined, const Color(0xFFE85D04)),
      ('Chinese', Icons.ramen_dining_rounded, const Color(0xFFDC2626)),
      ('Fast Food', Icons.lunch_dining_rounded, const Color(0xFFF59E0B)),
      ('Cafe', Icons.coffee_rounded, const Color(0xFF92400E)),
      ('Desserts', Icons.icecream_outlined, const Color(0xFFDB2777)),
      ('Healthy', Icons.eco_rounded, const Color(0xFF15803D)),
    ];
    return SizedBox(
      height: 100,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: cats.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final (label, icon, color) = cats[i];
          final isAll = label == 'All';
          final selected =
              isAll ? _selectedCuisine == null : _selectedCuisine == label;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedCuisine = isAll ? null : label);
            },
            child: Container(
              width: 72,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: selected ? color.withValues(alpha: 0.12) : GuestColors.surface,
                borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
                border: Border.all(
                  color: selected ? color : GuestColors.border,
                  width: selected ? 1.5 : 1,
                ),
                boxShadow: selected ? [] : GuestSpacing.cardShadow,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, color: color, size: 24),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: selected ? color : GuestColors.ink,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── Promo block ───────────────────────────────────────────────────────────

  Widget _buildPromo() {
    final promo = _banners.isNotEmpty
        ? GuestBannerCarousel(banners: _banners, onTap: _openBanner)
        : Container(
            padding: const EdgeInsets.all(GuestSpacing.cardPad),
            decoration: BoxDecoration(
              color: GuestColors.primaryDeep,
              borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
              boxShadow: GuestSpacing.softShadow(color: GuestColors.primary),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  right: -8,
                  bottom: -16,
                  child: Icon(
                    Icons.restaurant_menu_rounded,
                    size: 100,
                    color: Colors.white.withValues(alpha: 0.10),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Good Food Brighter Days',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _offers.isNotEmpty
                          ? '${_offers.length} offers near you'
                          : 'Discover the best places near you',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.w500,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: () => context.go('/offers'),
                      child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text(
                        'View Offers',
                        style: TextStyle(
                          color: GuestColors.primaryDeep,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    ),
                  ],
                ),
              ],
            ),
          );
    if (_offers.isEmpty) return promo;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        promo,
        const SizedBox(height: 12),
        SizedBox(
          height: 88,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _offers.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final o = Map<String, dynamic>.from(_offers[i] as Map);
              return Container(
                width: 200,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: GuestColors.primarySoft,
                  borderRadius:
                      BorderRadius.circular(GuestSpacing.radiusMd),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      o['code']?.toString() ?? 'Offer',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: GuestColors.primaryDeep,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      o['outletName']?.toString() ??
                          o['organizationName']?.toString() ??
                          'Special deal',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: GuestColors.muted,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ─── Popular Near You ──────────────────────────────────────────────────────

  Widget _buildPopularNearYou() {
    final all = _filteredOutlets;
    final outlets = _showAllPopular ? all : all.take(8).toList();
    if (outlets.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GuestSectionHeader(
          title: 'Popular Near You',
          emoji: '🔥',
          trailingLabel: _showAllPopular ? 'Show less' : 'See all',
          onTrailing: () => setState(() => _showAllPopular = !_showAllPopular),
        ),
        if (_showAllPopular)
          ...outlets.map((raw) {
            final o = Map<String, dynamic>.from(raw as Map);
            final org = o['organization'] is Map
                ? Map<String, dynamic>.from(o['organization'] as Map)
                : <String, dynamic>{};
            final cuisineTags = (o['cuisineTags'] as List?)
                ?.map((t) => t.toString())
                .join(' · ');
            final orgSlug = org['slug']?.toString();
            final slug = o['slug']?.toString();
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: GuestRestaurantCardHorizontal(
                name: o['name']?.toString() ?? '',
                imageUrl: o['coverImageUrl']?.toString() ??
                    o['imageUrl']?.toString(),
                cuisines: cuisineTags,
                distanceKm: (o['distanceKm'] as num?)?.toDouble(),
                rating: (o['averageRating'] as num?)?.toDouble(),
                etaMinutes: o['averagePrepMinutes'] != null
                    ? '~${o['averagePrepMinutes']} min'
                    : null,
                isOpen: o['openNow'] is bool ? o['openNow'] as bool : null,
                onTap: () {
                  if (orgSlug != null && slug != null) {
                    context.push('/o/$orgSlug/$slug');
                  }
                },
              ),
            );
          })
        else
          SizedBox(
            height: 268,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: outlets.length,
              separatorBuilder: (_, __) => const SizedBox(width: 14),
              itemBuilder: (_, i) {
                final o = Map<String, dynamic>.from(outlets[i] as Map);
                final org = o['organization'] is Map
                    ? Map<String, dynamic>.from(o['organization'] as Map)
                    : <String, dynamic>{};
                final cuisineTags = (o['cuisineTags'] as List?)
                    ?.map((t) => t.toString())
                    .join(' · ');
                final orgSlug = org['slug']?.toString();
                final slug = o['slug']?.toString();
                return GuestRestaurantCardHorizontal(
                  name: o['name']?.toString() ?? '',
                  imageUrl: o['coverImageUrl']?.toString() ??
                      o['imageUrl']?.toString(),
                  cuisines: cuisineTags,
                  distanceKm: (o['distanceKm'] as num?)?.toDouble(),
                  rating: (o['averageRating'] as num?)?.toDouble(),
                  etaMinutes: o['averagePrepMinutes'] != null
                      ? '~${o['averagePrepMinutes']} min'
                      : null,
                  isOpen: o['openNow'] is bool ? o['openNow'] as bool : null,
                  onTap: () {
                    if (orgSlug != null && slug != null) {
                      context.push('/o/$orgSlug/$slug');
                    }
                  },
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _buildSpecialDishes() {
    if (_specials.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const GuestSectionHeader(title: 'Special dishes', emoji: '✨'),
        SizedBox(
          height: 148,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _specials.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) {
              final item = _specials[i];
              final pricePaise = (item['price'] as num?)?.toDouble() ?? 0;
              final priceRupees = pricePaise / 100;
              final orgSlug = item['orgSlug']?.toString();
              final outletSlug = item['outletSlug']?.toString();
              final itemId = item['id']?.toString();
              return GestureDetector(
                onTap: () {
                  if (orgSlug != null &&
                      outletSlug != null &&
                      itemId != null) {
                    context.push('/o/$orgSlug/$outletSlug/item/$itemId');
                  } else if (orgSlug != null && outletSlug != null) {
                    context.push('/o/$orgSlug/$outletSlug');
                  }
                },
                child: Container(
                  width: 200,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: GuestColors.surface,
                    borderRadius:
                        BorderRadius.circular(GuestSpacing.radiusMd),
                    boxShadow: GuestSpacing.cardShadow,
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          width: 64,
                          height: 64,
                          child: GuestNetworkImage(
                            url: item['imageUrl']?.toString() ??
                                item['coverImageUrl']?.toString(),
                            borderRadius: BorderRadius.zero,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              item['name']?.toString() ?? '',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item['outletName']?.toString() ??
                                  item['organizationName']?.toString() ??
                                  '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                color: GuestColors.muted,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '₹${priceRupees.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ─── Cuisines for Every Mood ───────────────────────────────────────────────

  Widget _buildCuisinesForMood() {
    final cuisines = _uniqueCuisines;
    if (cuisines.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const GuestSectionHeader(
          title: 'Cuisines for Every Mood',
          emoji: '🍽️',
        ),
        SizedBox(
          height: 110,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: cuisines.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) {
              final label = cuisines[i];
              return GuestCuisineCircle(
                label: label,
                onTap: () {
                  setState(() => _selectedCuisine = label);
                },
              );
            },
          ),
        ),
      ],
    );
  }

  // ─── API discover sections ─────────────────────────────────────────────────

  Widget _buildSectionRow(
      Map<String, dynamic> section, List<Map<String, dynamic>> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        GuestSectionHeader(
          title: section['title']?.toString() ?? 'For you',
          emoji: '✨',
          subtitle: section['subtitle']?.toString(),
        ),
        SizedBox(
          height: 240,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 14),
            itemBuilder: (_, i) {
              final o = items[i];
              final org = o['organization'] is Map
                  ? Map<String, dynamic>.from(o['organization'] as Map)
                  : <String, dynamic>{};
              final cuisineTags = (o['cuisineTags'] as List?)
                  ?.map((t) => t.toString())
                  .join(' · ');
              final dist = o['distanceKm'];
              final rating = o['averageRating'];
              final prep = o['averagePrepMinutes'];
              return GuestRestaurantCardHorizontal(
                name: o['name']?.toString() ?? '',
                imageUrl: o['coverImageUrl']?.toString() ??
                    o['imageUrl']?.toString(),
                cuisines: cuisineTags,
                rating:
                    rating != null ? (rating as num).toDouble() : null,
                distanceKm:
                    dist != null ? (dist as num).toDouble() : null,
                etaMinutes: prep != null ? '~$prep min' : null,
                onTap: () {
                  final orgSlug = org['slug']?.toString();
                  final slug = o['slug']?.toString();
                  if (orgSlug != null && slug != null) {
                    context.push('/o/$orgSlug/$slug');
                  }
                },
              );
            },
          ),
        ),
      ],
    );
  }

  // ─── Recent orders ─────────────────────────────────────────────────────────

  Widget _buildRecentOrders() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GuestSectionHeader(
          title: 'Recent Orders',
          emoji: '🧾',
          trailingLabel: 'See all',
          onTrailing: () => context.go('/orders'),
        ),
        ..._recentOrders.take(2).map((raw) {
          final o = Map<String, dynamic>.from(raw as Map);
          final outlet = o['outlet'] is Map
              ? Map<String, dynamic>.from(o['outlet'] as Map)
              : null;
          final org = outlet?['organization'] is Map
              ? Map<String, dynamic>.from(outlet!['organization'] as Map)
              : null;
          final placeName = org?['name']?.toString() ??
              outlet?['name']?.toString() ??
              'Order';
          final outletName = outlet?['name']?.toString();
          final items = o['items'] is List
              ? List<dynamic>.from(o['items'] as List)
              : const <dynamic>[];
          final firstItem = items.isNotEmpty
              ? (items.first is Map
                  ? (items.first as Map)['name']?.toString()
                  : null)
              : null;
          final moreCount = items.length > 1 ? items.length - 1 : 0;
          final status = (o['status']?.toString() ?? '').toUpperCase();
          final total = o['total'] ?? o['grandTotal'] ?? 0;
          final created = o['createdAt']?.toString();
          String dateLabel = '';
          if (created != null) {
            final dt = DateTime.tryParse(created)?.toLocal();
            if (dt != null) {
              dateLabel = '${dt.day}/${dt.month}/${dt.year}';
            }
          }
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GuestSoftCard(
              onTap: () => context.push('/orders/${o['id']}'),
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: GuestColors.primarySoft,
                      borderRadius:
                          BorderRadius.circular(GuestSpacing.radiusSm),
                    ),
                    child: const Icon(Icons.receipt_long_rounded,
                        color: GuestColors.primary, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          placeName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 13),
                        ),
                        if (outletName != null &&
                            outletName != placeName) ...[
                          const SizedBox(height: 1),
                          Text(
                            outletName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 11, color: GuestColors.muted),
                          ),
                        ],
                        const SizedBox(height: 4),
                        Text(
                          firstItem != null
                              ? (moreCount > 0
                                  ? '$firstItem +$moreCount more'
                                  : firstItem)
                              : '#${o['orderNumber'] ?? o['id']}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12, color: GuestColors.ink),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: GuestColors.primarySoft,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                status.isEmpty ? 'ORDER' : status,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: GuestColors.primaryDeep,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '₹$total',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 12),
                            ),
                            if (dateLabel.isNotEmpty) ...[
                              const SizedBox(width: 8),
                              Text(
                                dateLabel,
                                style: const TextStyle(
                                    fontSize: 11, color: GuestColors.muted),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: GuestColors.muted),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  // ─── Favorites ─────────────────────────────────────────────────────────────

  Widget _buildFavorites() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GuestSectionHeader(
          title: 'Favorites',
          emoji: '💚',
          trailingLabel: 'Profile',
          onTrailing: () => context.go('/profile'),
        ),
        SizedBox(
          height: 90,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _favorites.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final f = Map<String, dynamic>.from(_favorites[i] as Map);
              final outlet =
                  Map<String, dynamic>.from(f['outlet'] as Map);
              final org = Map<String, dynamic>.from(
                  outlet['organization'] as Map);
              return GuestSoftCard(
                onTap: () => context.push(
                    '/o/${org['slug']}/${outlet['slug']}'),
                padding: const EdgeInsets.all(12),
                child: SizedBox(
                  width: 130,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.favorite_rounded,
                              color: GuestColors.popularRed, size: 14),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              outlet['name']?.toString() ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        org['name']?.toString() ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 11, color: GuestColors.muted),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ─── Loyalty ───────────────────────────────────────────────────────────────

  Widget _buildLoyalty() {
    final preview = _memberships.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GuestSectionHeader(
          title: 'Loyalty',
          trailingLabel: 'Rewards',
          onTrailing: () => context.push('/wallets'),
        ),
        if (preview.isEmpty)
          GuestSoftCard(
            onTap: () => context.push('/wallets'),
            padding: const EdgeInsets.all(12),
            child: const Row(
              children: [
                Icon(Icons.card_giftcard_rounded, color: GuestColors.primary),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Earn points at Cullinos partners — open Rewards',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
                Icon(Icons.chevron_right, color: GuestColors.muted),
              ],
            ),
          )
        else
          GuestSoftCard(
            onTap: () => context.push('/wallets'),
            padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
            child: Column(
              children: [
                for (var i = 0; i < preview.length; i++) ...[
                  if (i > 0)
                    const Divider(height: 14, color: GuestColors.borderLight),
                  Builder(builder: (_) {
                    final r =
                        Map<String, dynamic>.from(preview[i] as Map);
                    final org = Map<String, dynamic>.from(
                        r['organization'] as Map);
                    final pts = r['loyaltyPoints'] ?? 0;
                    return Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: GuestColors.primarySoft,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.storefront_rounded,
                              size: 16, color: GuestColors.primary),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            org['name']?.toString() ?? 'Restaurant',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                        Text(
                          '$pts pts',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                            color: GuestColors.primaryDeep,
                          ),
                        ),
                      ],
                    );
                  }),
                ],
                if (_memberships.length > 3) ...[
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'View all ${_memberships.length} restaurants →',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: GuestColors.primary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

class _FilterResult {
  const _FilterResult({
    required this.dineIn,
    required this.takeaway,
    required this.delivery,
    required this.offersOnly,
    required this.veg,
    required this.radiusKm,
  });

  final bool dineIn;
  final bool takeaway;
  final bool delivery;
  final bool offersOnly;
  final bool veg;
  final double radiusKm;
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({
    required this.dineIn,
    required this.takeaway,
    required this.delivery,
    required this.offersOnly,
    required this.veg,
    required this.radiusKm,
    required this.onApply,
  });

  final bool dineIn;
  final bool takeaway;
  final bool delivery;
  final bool offersOnly;
  final bool veg;
  final double radiusKm;
  final void Function(_FilterResult) onApply;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late bool _dineIn;
  late bool _takeaway;
  late bool _delivery;
  late bool _offersOnly;
  late bool _veg;
  late double _radiusKm;

  @override
  void initState() {
    super.initState();
    _dineIn = widget.dineIn;
    _takeaway = widget.takeaway;
    _delivery = widget.delivery;
    _offersOnly = widget.offersOnly;
    _veg = widget.veg;
    _radiusKm = widget.radiusKm;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: GuestColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Filter',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            const SizedBox(height: 16),
            const Text(
              'Order Mode',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _modeChip(
                    'Dine In', Icons.restaurant_rounded, _dineIn,
                    () => setState(() {
                          _dineIn = !_dineIn;
                          if (_dineIn) { _takeaway = false; _delivery = false; }
                        })),
                _modeChip(
                    'Takeaway', Icons.shopping_bag_outlined, _takeaway,
                    () => setState(() {
                          _takeaway = !_takeaway;
                          if (_takeaway) { _dineIn = false; _delivery = false; }
                        })),
                _modeChip(
                    'Delivery', Icons.delivery_dining_rounded, _delivery,
                    () => setState(() {
                          _delivery = !_delivery;
                          if (_delivery) { _dineIn = false; _takeaway = false; }
                        })),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: GuestColors.borderLight),
            const SizedBox(height: 8),
            Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Veg Only',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      Text('Show vegetarian restaurants',
                          style: TextStyle(
                              fontSize: 12, color: GuestColors.muted)),
                    ],
                  ),
                ),
                Switch(
                  value: _veg,
                  activeColor: GuestColors.primary,
                  onChanged: (v) => setState(() => _veg = v),
                ),
              ],
            ),
            Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Offers Only',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      Text('Show places with active deals',
                          style: TextStyle(
                              fontSize: 12, color: GuestColors.muted)),
                    ],
                  ),
                ),
                Switch(
                  value: _offersOnly,
                  activeColor: GuestColors.primary,
                  onChanged: (v) => setState(() => _offersOnly = v),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Divider(color: GuestColors.borderLight),
            const SizedBox(height: 12),
            Row(
              children: [
                const Text('Radius',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(width: 8),
                Text('${_radiusKm.toInt()} km',
                    style: const TextStyle(color: GuestColors.primary, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [5.0, 10.0, 15.0, 25.0].map((km) {
                final sel = _radiusKm == km;
                return ChoiceChip(
                  label: Text('${km.toInt()} km'),
                  selected: sel,
                  selectedColor: GuestColors.primarySoft,
                  onSelected: (_) => setState(() => _radiusKm = km),
                  labelStyle: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: sel ? GuestColors.primaryDeep : GuestColors.ink,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => widget.onApply(_FilterResult(
                  dineIn: _dineIn,
                  takeaway: _takeaway,
                  delivery: _delivery,
                  offersOnly: _offersOnly,
                  veg: _veg,
                  radiusKm: _radiusKm,
                )),
                style: FilledButton.styleFrom(
                  backgroundColor: GuestColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(GuestSpacing.radiusMd),
                  ),
                ),
                child: const Text(
                  'Apply Filters',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _modeChip(
      String label, IconData icon, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? GuestColors.primarySoft : GuestColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? GuestColors.primary : GuestColors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 16,
                color:
                    selected ? GuestColors.primary : GuestColors.muted),
            const SizedBox(width: 6),
            Text(
              label,
              softWrap: false,
              maxLines: 1,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: selected
                    ? GuestColors.primaryDeep
                    : GuestColors.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Helper widgets ───────────────────────────────────────────────────────────

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? GuestColors.primarySoft : GuestColors.surface,
          boxShadow: GuestSpacing.softShadow(),
        ),
        child: Icon(
          icon,
          color: active ? GuestColors.primary : GuestColors.ink,
          size: 22,
        ),
      ),
    );
  }
}

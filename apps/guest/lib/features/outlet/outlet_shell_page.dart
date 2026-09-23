import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:cullinos_guest/core/api_client.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/outlet/active_outlet_controller.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';
import 'package:cullinos_guest/features/outlet/menu_utils.dart';
import 'package:cullinos_guest/widgets/guest_badges.dart';
import 'package:cullinos_guest/widgets/guest_dish_card.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';
import 'package:cullinos_guest/widgets/guest_sticky_bars.dart';

class OutletShellPage extends ConsumerStatefulWidget {
  const OutletShellPage({
    super.key,
    required this.orgSlug,
    required this.outletSlug,
    this.sessionToken,
    this.tableCode,
  });

  final String orgSlug;
  final String outletSlug;
  final String? sessionToken;
  final String? tableCode;

  @override
  ConsumerState<OutletShellPage> createState() => _OutletShellPageState();
}

class _OutletShellPageState extends ConsumerState<OutletShellPage> {
  Map<String, dynamic>? _profile;
  String? _error;
  bool _loading = true;
  bool _favorited = false;
  Map<String, dynamic>? _reviews;
  List<Map<String, dynamic>> _storefrontCategories = [];
  List<Map<String, dynamic>> _offers = [];
  String? _resolvedSessionToken;
  String? _resolvedTableName;
  /// Per service-request type: epoch ms when cooldown ends.
  final Map<String, int> _serviceCooldownUntil = {};
  Timer? _serviceCooldownTicker;

  static const _serviceCooldownMs = 60000;

  String? get _activeSessionToken =>
      _resolvedSessionToken ?? widget.sessionToken;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void dispose() {
    _serviceCooldownTicker?.cancel();
    super.dispose();
  }

  void _ensureCooldownTicker() {
    if (_serviceCooldownTicker != null) return;
    _serviceCooldownTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      final now = DateTime.now().millisecondsSinceEpoch;
      final expired = _serviceCooldownUntil.entries
          .where((e) => e.value <= now)
          .map((e) => e.key)
          .toList();
      if (expired.isEmpty && _serviceCooldownUntil.isEmpty) {
        _serviceCooldownTicker?.cancel();
        _serviceCooldownTicker = null;
        return;
      }
      if (expired.isNotEmpty || mounted) {
        setState(() {
          for (final k in expired) {
            _serviceCooldownUntil.remove(k);
          }
        });
      }
      if (_serviceCooldownUntil.isEmpty) {
        _serviceCooldownTicker?.cancel();
        _serviceCooldownTicker = null;
      }
    });
  }

  int _cooldownLeftSec(String type) {
    final until = _serviceCooldownUntil[type];
    if (until == null) return 0;
    final left = until - DateTime.now().millisecondsSinceEpoch;
    return left <= 0 ? 0 : (left / 1000).ceil();
  }

  Future<void> _requestService(String type) async {
    final token = _activeSessionToken;
    if (token == null) return;
    if (_cooldownLeftSec(type) > 0) return;
    try {
      await ref.read(dioProvider).post(
        '/public/sessions/$token/service-requests',
        data: {'type': type},
      );
      if (!mounted) return;
      setState(() {
        _serviceCooldownUntil[type] =
            DateTime.now().millisecondsSinceEpoch + _serviceCooldownMs;
      });
      _ensureCooldownTicker();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Requested $type')),
      );
    } catch (e) {
      if (!mounted) return;
      final remaining = _parseCooldownMs(e);
      if (remaining != null) {
        setState(() {
          _serviceCooldownUntil[type] =
              DateTime.now().millisecondsSinceEpoch + remaining;
        });
        _ensureCooldownTicker();
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyApiError(e))),
      );
    }
  }

  int? _parseCooldownMs(Object e) {
    try {
      // DioException response body
      final dynamic err = e;
      final data = err.response?.data;
      if (data is Map) {
        final details = data['error'] is Map
            ? (data['error'] as Map)['details']
            : data['details'];
        if (details is Map && details['cooldownRemainingMs'] != null) {
          return (details['cooldownRemainingMs'] as num).toInt();
        }
      }
    } catch (_) {}
    return null;
  }

  // ─── Boot (data loading) ────────────────────────────────────────────────────

  Future<void> _boot() async {
    try {
      final api = ref.read(guestApiProvider);
      final auth = ref.read(authControllerProvider);
      final profile =
          await api.outletProfile(widget.orgSlug, widget.outletSlug);
      final org = Map<String, dynamic>.from(profile['organization'] as Map);
      final outlet = Map<String, dynamic>.from(profile['outlet'] as Map);

      String? customerId;
      if (auth.isAuthenticated) {
        try {
          final membership =
              await api.ensureMembership(org['id'] as String);
          customerId = membership['customerId'] as String?;
          final customerToken = membership['customerAccessToken'] as String?;
          if (customerToken != null) {
            await auth.saveCustomerToken(org['id'] as String, customerToken);
          }
        } catch (_) {
          // Guest can still browse; checkout will require sign-in.
        }
      }

      ref.read(cartProvider).bindOutlet(
            orgId: org['id'] as String,
            outletId: outlet['id'] as String,
            orgSlug: widget.orgSlug,
            outletSlug: widget.outletSlug,
            customerId: customerId,
            sessionToken: widget.sessionToken,
            restaurantName: outlet['name']?.toString() ?? org['name']?.toString(),
            restaurantImageUrl: outlet['coverImageUrl']?.toString() ??
                org['logoUrl']?.toString(),
            restaurantLocation: [
              outlet['city'],
              outlet['address'],
            ].where((e) => e != null && e.toString().isNotEmpty).join(' · '),
          );

      String? resolvedSession = widget.sessionToken;
      String? resolvedTableName;
      if ((resolvedSession == null || resolvedSession.isEmpty) &&
          widget.tableCode != null &&
          widget.tableCode!.trim().isNotEmpty) {
        try {
          final joined = await api.joinTableByQr(widget.tableCode!.trim());
          resolvedSession = joined['sessionToken']?.toString();
          resolvedTableName =
              joined['tableName']?.toString() ?? joined['table']?.toString();
          if (resolvedSession != null && resolvedSession.isNotEmpty) {
            ref.read(cartProvider).setSession(
                  sessionToken: resolvedSession,
                  tableName: resolvedTableName,
                );
          }
        } catch (_) {
          // Still allow browsing; ordering as dine-in session may fail later.
        }
      }

      final brand = profile['brand'] is Map
          ? Map<String, dynamic>.from(profile['brand'] as Map)
          : <String, dynamic>{};
      final brandSettings = brand['settings'] is Map
          ? Map<String, dynamic>.from(brand['settings'] as Map)
          : <String, dynamic>{};
      final outletSettings = outlet['settings'] is Map
          ? Map<String, dynamic>.from(outlet['settings'] as Map)
          : (profile['outletSettings'] is Map
              ? Map<String, dynamic>.from(profile['outletSettings'] as Map)
              : <String, dynamic>{});
      final themeBlock = profile['theme'] is Map
          ? Map<String, dynamic>.from(profile['theme'] as Map)
          : <String, dynamic>{};
      ref.read(activeOutletProvider).setOutlet(
            orgSlug: widget.orgSlug,
            outletSlug: widget.outletSlug,
            orgId: org['id'] as String?,
            outletId: outlet['id'] as String?,
            name: outlet['name']?.toString(),
            themeKey: themeBlock['guestThemeKey']?.toString() ??
                outlet['guestThemeKey']?.toString() ??
                outletSettings['guestThemeKey']?.toString() ??
                brandSettings['guestThemeKey']?.toString(),
            primaryColor: themeBlock['primaryColor']?.toString() ??
                outlet['primaryColor']?.toString() ??
                brandSettings['primaryColor']?.toString() ??
                outletSettings['primaryColor']?.toString(),
            accentColor: themeBlock['accentColor']?.toString() ??
                outlet['accentColor']?.toString() ??
                brandSettings['accentColor']?.toString() ??
                outletSettings['accentColor']?.toString(),
          );

      if (resolvedSession != null && resolvedSession.isNotEmpty) {
        ref.read(cartProvider).setOrderType('dine_in');
      }

      bool favorited = false;
      Map<String, dynamic>? reviews;
      List<Map<String, dynamic>> storefrontCats = [];

      if (auth.isAuthenticated) {
        try {
          final favs = await api.favoriteOutlets();
          favorited = favs.any((raw) {
            final f = Map<String, dynamic>.from(raw as Map);
            return f['outletId'] == outlet['id'];
          });
        } catch (_) {}
      }

      try {
        reviews = await api.outletReviews(outlet['id'] as String);
      } catch (_) {}

      try {
        final storefrontData =
            await api.storefront(widget.orgSlug, widget.outletSlug);
        storefrontCats = parseStorefrontCategories(storefrontData);
      } catch (_) {}

      if (!mounted) return;
      final offersRaw = profile['offers'];
      final offers = offersRaw is List
          ? offersRaw
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList()
          : <Map<String, dynamic>>[];
      setState(() {
        _profile = profile;
        _favorited = favorited;
        _reviews = reviews;
        _storefrontCategories = storefrontCats;
        _offers = offers;
        _resolvedSessionToken = resolvedSession;
        _resolvedTableName = resolvedTableName;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyApiError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ─── Favorite toggle ────────────────────────────────────────────────────────

  Future<void> _toggleFavorite() async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isAuthenticated) {
      final next = Uri.encodeComponent(
          GoRouterState.of(context).uri.toString());
      context.push('/login?next=$next');
      return;
    }
    final outlet =
        Map<String, dynamic>.from(_profile!['outlet'] as Map);
    final outletId = outlet['id']?.toString();
    if (outletId == null) return;
    try {
      if (_favorited) {
        await ref.read(guestApiProvider).removeFavoriteOutlet(outletId);
      } else {
        await ref.read(guestApiProvider).addFavoriteOutlet(outletId);
      }
      if (mounted) setState(() => _favorited = !_favorited);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update favourite')),
        );
      }
    }
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: GuestColors.scaffold,
        body: GuestLoading(),
      );
    }
    if (_error != null || _profile == null) {
      return Scaffold(
        backgroundColor: GuestColors.scaffold,
        appBar: AppBar(),
        body: Center(child: Text(_error ?? 'Outlet not found')),
      );
    }

    final cart = ref.watch(cartProvider);
    final org =
        Map<String, dynamic>.from(_profile!['organization'] as Map);
    final outlet =
        Map<String, dynamic>.from(_profile!['outlet'] as Map);
    final modes = Map<String, dynamic>.from(
        _profile!['orderModes'] as Map? ?? {});
    final cuisine =
        List<dynamic>.from(outlet['cuisineTags'] as List? ?? []);
    final coverUrl = outlet['coverImageUrl']?.toString() ??
        org['logoUrl']?.toString();

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: GuestColors.scaffold,
        body: NestedScrollView(
          headerSliverBuilder: (ctx, _) => [
            // ── Hero + info card ─────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildHeroSection(outlet, org, cuisine, coverUrl),
            ),
            // ── Service highlight chips ──────────────────────────────
            SliverToBoxAdapter(
              child: _buildModeChips(modes),
            ),
            // ── Sticky tab bar ───────────────────────────────────────
            SliverPersistentHeader(
              pinned: true,
              delegate: _StickyTabDelegate(
                child: Container(
                  color: GuestColors.surface,
                  child: TabBar(
                    labelColor: GuestColors.primaryOf(context),
                    unselectedLabelColor: GuestColors.muted,
                    indicatorColor: GuestColors.primaryOf(context),
                    indicatorWeight: 2.5,
                    labelStyle: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 14),
                    tabs: const [
                      Tab(text: 'Menu'),
                      Tab(text: 'Reviews'),
                      Tab(text: 'Photos'),
                      Tab(text: 'About'),
                    ],
                  ),
                ),
                height: kTextTabBarHeight + 1,
              ),
            ),
          ],
          body: TabBarView(
            children: [
              _buildMenuTab(outlet, org),
              _buildReviewsTab(),
              _buildPhotosTab(outlet),
              _buildAboutTab(outlet, org, modes, cuisine),
            ],
          ),
        ),
        bottomNavigationBar: cart.lines.isEmpty
            ? SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      GuestSpacing.page, 0, GuestSpacing.page, 12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GuestPillButton(
                        label: 'Reserve a table',
                        icon: Icons.event_seat_rounded,
                        onPressed: () => context.push(
                            '/o/${widget.orgSlug}/${widget.outletSlug}/book'),
                      ),
                      const SizedBox(height: 8),
                      GuestPillButton(
                        label: 'View Full Menu',
                        icon: Icons.restaurant_menu_rounded,
                        onPressed: () => context.push(
                            '/o/${widget.orgSlug}/${widget.outletSlug}/menu'),
                      ),
                    ],
                  ),
                ),
              )
            : GuestCartStickyBar(
                itemCount: cart.itemCount,
                totalLabel: '₹${cart.subtotal.toStringAsFixed(0)}',
                onViewCart: () => context.push(
                    '/o/${widget.orgSlug}/${widget.outletSlug}/cart'),
              ),
      ),
    );
  }

  // ─── Hero + overlapping info card ─────────────────────────────────────────

  Widget _buildHeroSection(
    Map<String, dynamic> outlet,
    Map<String, dynamic> org,
    List<dynamic> cuisine,
    String? coverUrl,
  ) {
    final safeTopPad =
        MediaQuery.of(context).padding.top;
    const heroH = 220.0;
    const cardTopOffset = 175.0; // card starts 45px before hero ends
    const totalH = cardTopOffset + 155.0; // card is ~155px tall

    final rating = outlet['averageRating'];
    final dist = outlet['distanceKm'];
    final prep = outlet['averagePrepMinutes'];

    return SizedBox(
      height: totalH,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // ── Hero image ──────────────────────────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: heroH,
            child: GuestNetworkImage(
              url: coverUrl,
              borderRadius: BorderRadius.zero,
              icon: Icons.storefront_rounded,
            ),
          ),
          // ── Gradient overlay ────────────────────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: heroH,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.15),
                    Colors.black.withValues(alpha: 0.55),
                  ],
                ),
              ),
            ),
          ),
          // ── Back + fav + share buttons ──────────────────────────────
          Positioned(
            top: safeTopPad + 8,
            left: 12,
            right: 12,
            child: Row(
              children: [
                _OverlayBtn(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.canPop()
                      ? context.pop()
                      : context.go('/'),
                ),
                const Spacer(),
                _OverlayBtn(
                  icon: _favorited
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  iconColor:
                      _favorited ? GuestColors.popularRed : Colors.white,
                  onTap: _toggleFavorite,
                ),
                const SizedBox(width: 8),
                _OverlayBtn(
                  icon: Icons.share_outlined,
                  onTap: () => _shareOutlet(org, outlet),
                ),
              ],
            ),
          ),
          // ── Overlapping info card ────────────────────────────────────
          Positioned(
            top: cardTopOffset,
            left: GuestSpacing.page,
            right: GuestSpacing.page,
            child: Container(
              padding: const EdgeInsets.all(GuestSpacing.cardPad),
              decoration: BoxDecoration(
                color: GuestColors.surface,
                borderRadius:
                    BorderRadius.circular(GuestSpacing.radiusMd),
                boxShadow: GuestSpacing.cardShadow,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Logo circle
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: GuestColors.primarySoftOf(context),
                      border: Border.all(
                          color: GuestColors.border, width: 1.5),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: GuestNetworkImage(
                      url: org['logoUrl']?.toString(),
                      borderRadius: const BorderRadius.all(
                          Radius.circular(999)),
                      icon: Icons.storefront_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          org['name']?.toString() ??
                              outlet['name']?.toString() ??
                              'Restaurant',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: GuestColors.ink,
                          ),
                        ),
                        if (outlet['name'] != null &&
                            outlet['name'].toString() !=
                                org['name']?.toString()) ...[
                          const SizedBox(height: 1),
                          Text(
                            outlet['name'].toString(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: GuestColors.muted,
                            ),
                          ),
                        ],
                        Builder(builder: (_) {
                          final brand = _profile?['brand'] is Map
                              ? Map<String, dynamic>.from(
                                  _profile!['brand'] as Map)
                              : null;
                          final desc = (brand?['description']?.toString() ??
                                  '')
                              .trim();
                          final fallback = [
                            outlet['address'],
                            outlet['city'],
                          ]
                              .where((e) =>
                                  e != null &&
                                  e.toString().trim().isNotEmpty)
                              .join(', ');
                          final text = desc.isNotEmpty
                              ? desc
                              : (fallback.isNotEmpty
                                  ? fallback
                                  : cuisine
                                      .map((t) => t.toString())
                                      .join(' · '));
                          if (text.isEmpty) {
                            return const SizedBox.shrink();
                          }
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              text,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                color: GuestColors.muted,
                                height: 1.3,
                              ),
                            ),
                          );
                        }),
                        if (cuisine.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            cuisine.map((t) => t.toString()).join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: GuestColors.muted,
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        // Rating + distance + prep row
                        Row(
                          children: [
                            if (rating != null) ...[
                              const Icon(Icons.star_rounded,
                                  size: 14, color: GuestColors.star),
                              const SizedBox(width: 2),
                              Text(
                                (rating as num).toStringAsFixed(1),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            if (dist != null) ...[
                              const Icon(Icons.near_me_rounded,
                                  size: 12, color: GuestColors.muted),
                              const SizedBox(width: 2),
                              Text(
                                '${(dist as num).toStringAsFixed(1)} km',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: GuestColors.muted,
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            if (prep != null) ...[
                              const Icon(Icons.schedule_rounded,
                                  size: 12, color: GuestColors.muted),
                              const SizedBox(width: 2),
                              Text(
                                '~$prep min',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: GuestColors.muted,
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 6),
                        GuestOpenNowDot(
                          open: outlet['openNow'] is bool
                              ? outlet['openNow'] as bool
                              : true,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _shareOutlet(
    Map<String, dynamic> org,
    Map<String, dynamic> outlet,
  ) async {
    final orgName = org['name']?.toString() ?? 'Restaurant';
    final outletName = outlet['name']?.toString();
    final title = outletName != null && outletName != orgName
        ? '$orgName · $outletName'
        : orgName;
    final url =
        'https://guest.cullinos.com/o/${widget.orgSlug}/${widget.outletSlug}';
    await Share.share('Check out $title on Cullinos\n$url');
  }

  // ─── Mode / service chips ──────────────────────────────────────────────────

  Widget _buildModeChips(Map<String, dynamic> modes) {
    final chips = <Widget>[];
    if (modes['delivery'] == true) {
      chips.add(_ServiceChip(
        icon: Icons.delivery_dining_rounded,
        label: 'Free Delivery',
        color: GuestColors.primaryOf(context),
      ));
    }
    if (modes['dineIn'] == true) {
      chips.add(_ServiceChip(
        icon: Icons.table_restaurant_rounded,
        label: 'Dine-in',
        color: GuestColors.ink,
      ));
    }
    if (modes['takeaway'] == true) {
      chips.add(_ServiceChip(
        icon: Icons.shopping_bag_outlined,
        label: 'Takeaway',
        color: GuestColors.ink,
      ));
    }
    if (chips.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          GuestSpacing.page, 10, GuestSpacing.page, 0),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        children: chips,
      ),
    );
  }

  // ─── Menu tab ──────────────────────────────────────────────────────────────

  Widget _buildMenuTab(
      Map<String, dynamic> outlet, Map<String, dynamic> org) {
    final allItems = _storefrontCategories
        .expand((cat) =>
            (cat['items'] as List? ?? []).cast<Map<String, dynamic>>())
        .toList();
    final specialItems =
        allItems.where((i) => i['isSpecial'] == true).take(8).toList();
    final popularItems = allItems.take(8).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
          GuestSpacing.page, 16, GuestSpacing.page, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_offers.isNotEmpty) ...[
            const GuestSectionHeader(title: 'Offers', emoji: '🏷️'),
            SizedBox(
              height: 88,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _offers.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) {
                  final offer = _offers[i];
                  final title = offer['title']?.toString().isNotEmpty == true
                      ? offer['title'].toString()
                      : offer['code']?.toString() ?? 'Offer';
                  final desc = offer['description']?.toString() ??
                      (offer['code'] != null
                          ? 'Use code ${offer['code']}'
                          : '');
                  return Container(
                    width: 220,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: GuestColors.surface,
                      borderRadius:
                          BorderRadius.circular(GuestSpacing.radiusMd),
                      border: Border.all(color: GuestColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          desc,
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
            const SizedBox(height: 16),
          ],
          if (specialItems.isNotEmpty) ...[
            const GuestSectionHeader(title: 'Special dishes', emoji: '✨'),
            SizedBox(
              height: 220,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: specialItems.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) {
                  final item = specialItems[i];
                  final price =
                      (item['price'] as num?)?.toDouble() ?? 0.0;
                  return SizedBox(
                    width: 160,
                    child: GuestDishCard(
                      name: item['name']?.toString() ?? '',
                      priceLabel: '₹${price.toStringAsFixed(0)}',
                      imageUrl: item['imageUrl']?.toString(),
                      description: item['description']?.toString(),
                      badgeLabel: 'Special',
                      onTap: () => context.push(
                        '/o/${widget.orgSlug}/${widget.outletSlug}/item/${item['id']}',
                      ),
                      onAdd: () => context.push(
                        '/o/${widget.orgSlug}/${widget.outletSlug}/item/${item['id']}',
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],
          if (popularItems.isNotEmpty) ...[
            const GuestSectionHeader(
                title: 'Popular Dishes', emoji: '⭐'),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.72,
              ),
              itemCount: popularItems.length,
              itemBuilder: (_, i) {
                final item = popularItems[i];
                final price =
                    (item['price'] as num?)?.toDouble() ?? 0.0;
                return GuestDishCard(
                  name: item['name']?.toString() ?? '',
                  priceLabel: '₹${price.toStringAsFixed(0)}',
                  imageUrl: item['imageUrl']?.toString(),
                  description: item['description']?.toString(),
                  onTap: () => context.push(
                    '/o/${widget.orgSlug}/${widget.outletSlug}/item/${item['id']}',
                  ),
                  onAdd: () {
                    final variants = List<Map<String, dynamic>>.from(
                      (item['variants'] as List? ?? [])
                          .map((v) => Map<String, dynamic>.from(v as Map)),
                    );
                    final groups = List<Map<String, dynamic>>.from(
                      (item['modifierGroups'] as List? ?? [])
                          .map((g) => Map<String, dynamic>.from(g as Map)),
                    );
                    if (variants.isEmpty && groups.isEmpty) {
                      // Simple item — add directly
                      ref.read(cartProvider).addItem(
                            menuItemId: item['id'].toString(),
                            name: item['name']?.toString() ?? '',
                            unitPrice: price,
                            imageUrl: item['imageUrl']?.toString(),
                            isVeg: item['isVeg'] as bool?,
                          );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                              '${item['name']} added to cart'),
                          duration: const Duration(seconds: 1),
                        ),
                      );
                    } else {
                      // Navigate to detail for variant/mod selection
                      context.push(
                        '/o/${widget.orgSlug}/${widget.outletSlug}/item/${item['id']}',
                      );
                    }
                  },
                );
              },
            ),
            const SizedBox(height: 16),
          ] else ...[
            const GuestEmptyState(
              message: 'Menu preview unavailable. Use View Full Menu below.',
              icon: Icons.restaurant_menu_outlined,
            ),
          ],
        ],
      ),
    );
  }

  // ─── Reviews tab ───────────────────────────────────────────────────────────

  Widget _buildReviewsTab() {
    if (_reviews == null) {
      return const Center(
        child: GuestEmptyState(
          message: 'No reviews yet.',
          icon: Icons.star_outline_rounded,
        ),
      );
    }

    final averageRating = _reviews!['averageRating'];
    final count = _reviews!['count'] ?? 0;
    final reviewList =
        List<dynamic>.from(_reviews!['reviews'] as List? ?? []);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
          GuestSpacing.page, 16, GuestSpacing.page, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (averageRating != null)
            GuestSoftCard(
              child: Row(
                children: [
                  Text(
                    '${(averageRating as num).toStringAsFixed(1)}',
                    style: const TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      color: GuestColors.ink,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: List.generate(5, (i) {
                          return Icon(
                            i < (averageRating as num).round()
                                ? Icons.star_rounded
                                : Icons.star_outline_rounded,
                            size: 20,
                            color: GuestColors.star,
                          );
                        }),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Based on $count review${count == 1 ? '' : 's'}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: GuestColors.muted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          if (reviewList.isEmpty)
            const GuestEmptyState(
              message: 'Be the first to leave a review!',
              icon: Icons.rate_review_outlined,
            )
          else
            for (final raw in reviewList)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Builder(builder: (ctx) {
                  final r = Map<String, dynamic>.from(raw as Map);
                  final rRating = r['rating'];
                  return GuestSoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                r['guestName']?.toString() ?? 'Guest',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                            if (rRating != null)
                              Row(children: [
                                const Icon(Icons.star_rounded,
                                    size: 14,
                                    color: GuestColors.star),
                                const SizedBox(width: 2),
                                Text(
                                  '$rRating',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                              ]),
                          ],
                        ),
                        if ((r['comment']?.toString() ?? '')
                            .isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            r['comment'].toString(),
                            style: const TextStyle(
                              color: GuestColors.muted,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                }),
              ),
        ],
      ),
    );
  }

  // ─── Photos tab ────────────────────────────────────────────────────────────

  Widget _buildPhotosTab(Map<String, dynamic> outlet) {
    final photos = <String>[];
    final cover = outlet['coverImageUrl']?.toString() ?? '';
    if (cover.isNotEmpty) photos.add(cover);
    final fromUrls = (outlet['photoUrls'] as List?)
            ?.map((e) => e.toString())
            .where((s) => s.isNotEmpty)
            .toList() ??
        [];
    final fromPhotos = (outlet['photos'] as List?)
            ?.map((e) {
              if (e is Map) return e['url']?.toString() ?? '';
              return e.toString();
            })
            .where((s) => s.isNotEmpty)
            .toList() ??
        [];
    for (final url in [...fromUrls, ...fromPhotos]) {
      if (!photos.contains(url)) photos.add(url);
    }

    if (photos.isEmpty) {
      return const Center(
        child: GuestEmptyState(
          message: 'No photos yet.',
          icon: Icons.photo_library_outlined,
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(
          GuestSpacing.page, 16, GuestSpacing.page, 120),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemCount: photos.length,
      itemBuilder: (_, i) => GuestNetworkImage(
        url: photos[i],
        borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
        fit: BoxFit.cover,
      ),
    );
  }

  // ─── About tab ─────────────────────────────────────────────────────────────

  Widget _buildAboutTab(
    Map<String, dynamic> outlet,
    Map<String, dynamic> org,
    Map<String, dynamic> modes,
    List<dynamic> cuisine,
  ) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
          GuestSpacing.page, 16, GuestSpacing.page, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Location ──────────────────────────────────────────────
          const GuestSectionHeader(
              title: 'Location & Details', emoji: 'ℹ️'),
          GuestSoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if ((outlet['address']?.toString() ?? '').isNotEmpty ||
                    (outlet['city']?.toString() ?? '').isNotEmpty)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.location_on_outlined,
                          size: 18, color: GuestColors.primaryOf(context)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          [outlet['address'], outlet['city']]
                              .where((e) =>
                                  e != null &&
                                  e.toString().isNotEmpty)
                              .join(', '),
                          style: const TextStyle(
                            color: GuestColors.muted,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ],
                  ),
                if (cuisine.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.restaurant_rounded,
                          size: 18, color: GuestColors.primaryOf(context)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          cuisine.map((t) => t.toString()).join(' · '),
                          style: const TextStyle(
                              color: GuestColors.muted),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    if (modes['dineIn'] == true)
                      _ServiceChip(
                          icon: Icons.table_restaurant_rounded,
                          label: 'Dine-in',
                          color: GuestColors.ink),
                    if (modes['takeaway'] == true)
                      _ServiceChip(
                          icon: Icons.shopping_bag_outlined,
                          label: 'Takeaway',
                          color: GuestColors.ink),
                    if (modes['delivery'] == true)
                      _ServiceChip(
                          icon: Icons.delivery_dining_rounded,
                          label: 'Delivery',
                          color: GuestColors.primaryOf(context)),
                  ],
                ),
              ],
            ),
          ),

          // ── Table session / service requests ────────────────────────
          if (_activeSessionToken != null) ...[
            const SizedBox(height: 16),
            const GuestSectionHeader(
                title: 'Service Requests', emoji: '🛎️'),
            GuestSoftCard(
              color: GuestColors.primarySoftOf(context),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.table_restaurant_rounded,
                          color: GuestColors.primaryOf(context)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _resolvedTableName != null
                              ? 'Table $_resolvedTableName — tap to call for service.'
                              : 'Table session active — tap to call for service.',
                          style:
                              TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final type in [
                        'waiter',
                        'water',
                        'bill',
                        'cutlery',
                        'napkins',
                      ])
                        Builder(builder: (context) {
                          final left = _cooldownLeftSec(type);
                          final cooling = left > 0;
                          return ActionChip(
                            label: Text(
                              cooling
                                  ? '${type[0].toUpperCase()}${type.substring(1)} (${left}s)'
                                  : type[0].toUpperCase() + type.substring(1),
                            ),
                            backgroundColor: GuestColors.surface,
                            side: const BorderSide(color: GuestColors.border),
                            onPressed: cooling
                                ? null
                                : () => _requestService(type),
                          );
                        }),
                    ],
                  ),
                ],
              ),
            ),
          ],

          // ── Loyalty ──────────────────────────────────────────────────
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => context.push('/wallets'),
            child: const Text('View loyalty at this place'),
          ),

          if (_resolvedTableName != null || widget.tableCode != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                _resolvedTableName != null
                    ? 'Table: $_resolvedTableName'
                    : 'Table code: ${widget.tableCode}',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: GuestColors.muted),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Helper widgets ────────────────────────────────────────────────────────────

class _OverlayBtn extends StatelessWidget {
  const _OverlayBtn({
    required this.icon,
    required this.onTap,
    this.iconColor = Colors.white,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.black.withValues(alpha: 0.38),
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
    );
  }
}

class _ServiceChip extends StatelessWidget {
  const _ServiceChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: GuestColors.primarySoftOf(context),
        borderRadius: BorderRadius.circular(GuestSpacing.radiusPill),
        border: Border.all(
            color: GuestColors.primaryOf(context).withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            softWrap: false,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Sticky tab bar delegate ───────────────────────────────────────────────────

class _StickyTabDelegate extends SliverPersistentHeaderDelegate {
  _StickyTabDelegate({required this.child, required this.height});

  final Widget child;
  final double height;

  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;

  @override
  Widget build(
          BuildContext context, double shrinkOffset, bool overlapsContent) =>
      child;

  @override
  bool shouldRebuild(covariant _StickyTabDelegate old) => false;
}

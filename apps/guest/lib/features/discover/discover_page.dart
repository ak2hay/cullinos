import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/location/guest_location_controller.dart';
import 'package:cullinos_guest/widgets/guest_badges.dart';
import 'package:cullinos_guest/widgets/guest_banner_carousel.dart';
import 'package:cullinos_guest/widgets/guest_brand_wordmark.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_location_chip.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

/// Home dashboard — featured place, quick actions, loyalty, browse entry points.
/// Marketplace discovery lives on [ExplorePage].
class DiscoverPage extends ConsumerStatefulWidget {
  const DiscoverPage({super.key});

  @override
  ConsumerState<DiscoverPage> createState() => _DiscoverPageState();
}

class _DiscoverPageState extends ConsumerState<DiscoverPage> {
  List<dynamic> _outlets = [];
  List<Map<String, dynamic>> _banners = [];
  List<dynamic> _offers = [];
  List<dynamic> _recentOrders = [];
  List<dynamic> _favorites = [];
  List<dynamic> _memberships = [];
  int _coinsBalance = 0;
  int _unreadNotifications = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final loc = ref.read(guestLocationProvider);
    if (!loc.state.hasCoords) {
      await loc.detectAuto();
    }
    await _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final loc = ref.read(guestLocationProvider).state;
      final lat = loc.lat;
      final lng = loc.lng;

      final api = ref.read(guestApiProvider);
      var nearby = await api.nearby(lat: lat, lng: lng);
      var nearbyOutlets = List<dynamic>.from(nearby['outlets'] as List? ?? []);
      if (nearbyOutlets.isEmpty && lat != null && lng != null) {
        nearby = await api.nearby();
        nearbyOutlets = List<dynamic>.from(nearby['outlets'] as List? ?? []);
      }

      List<Map<String, dynamic>> banners = [];
      try {
        final bannerRes = await api.banners(lat: lat, lng: lng);
        banners = List<dynamic>.from(bannerRes['banners'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {}

      Map<String, dynamic> offersRes = {};
      try {
        offersRes = await api.offers(lat: lat, lng: lng);
      } catch (_) {}

      List<dynamic> recent = [];
      List<dynamic> favs = [];
      List<dynamic> wallets = [];
      int coins = 0;
      int unread = 0;
      if (ref.read(authControllerProvider).isAuthenticated) {
        try {
          recent = await api.orders();
        } catch (_) {}
        try {
          favs = await api.favoriteOutlets();
        } catch (_) {}
        try {
          wallets = await api.memberships();
        } catch (_) {}
        try {
          final coinsData = await api.coins();
          coins = (coinsData['balance'] as num?)?.toInt() ??
              (coinsData['coins'] as num?)?.toInt() ??
              0;
        } catch (_) {}
        try {
          unread = await api.unreadNotificationCount();
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        _outlets = nearbyOutlets;
        _banners = banners;
        _offers = List<dynamic>.from(offersRes['offers'] as List? ?? []);
        _recentOrders = recent;
        _favorites = favs;
        _memberships = wallets;
        _coinsBalance = coins;
        _unreadNotifications = unread;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyApiError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> _orgOf(Map<String, dynamic> o) {
    if (o['organization'] is Map) {
      return Map<String, dynamic>.from(o['organization'] as Map);
    }
    return {};
  }

  void _openOutlet(Map<String, dynamic> o) {
    final org = _orgOf(o);
    final orgSlug =
        org['slug']?.toString() ?? o['organizationSlug']?.toString();
    final slug = o['slug']?.toString() ?? o['outletSlug']?.toString();
    if (orgSlug != null && slug != null) {
      context.push('/o/$orgSlug/$slug');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    ref.watch(guestLocationProvider);

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      body: SafeArea(
        child: _loading
            ? const GuestLoading()
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    color: GuestColors.primary,
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(
                        GuestSpacing.page,
                        12,
                        GuestSpacing.page,
                        110,
                      ),
                      children: [
                        _buildHeader(auth.isAuthenticated),
                        const SizedBox(height: 16),
                        _buildLocationRow(),
                        const SizedBox(height: 16),
                        _buildHero(),
                        const SizedBox(height: 18),
                        _buildServiceGrid(),
                        const SizedBox(height: 22),
                        _buildLoyalty(),
                        const SizedBox(height: 16),
                        _buildCoinsCard(auth.isAuthenticated),
                        const SizedBox(height: 22),
                        _buildAllPlaces(),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildLocationRow() {
    return Row(
      children: [
        Expanded(
          child: GuestLocationChip(onChanged: _load),
        ),
        const SizedBox(width: 8),
        _CircleIcon(
          icon: Icons.search_rounded,
          onTap: () => context.go('/explore'),
        ),
        const SizedBox(width: 8),
        _CircleIcon(
          icon: Icons.qr_code_scanner_rounded,
          onTap: () => context.push('/scan'),
        ),
      ],
    );
  }

  Widget _buildHeader(bool authed) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GuestBrandWordmark(compact: true),
              SizedBox(height: 2),
              Text(
                'Good Food. Great People.',
                style: TextStyle(
                  fontSize: 12,
                  color: GuestColors.muted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        Stack(
          clipBehavior: Clip.none,
          children: [
            _CircleIcon(
              icon: Icons.notifications_none_rounded,
              onTap: () {
                if (!authed) {
                  context.push(
                      '/login?next=${Uri.encodeComponent('/notifications')}');
                  return;
                }
                context.push('/notifications').then((_) {
                  if (mounted) _load();
                });
              },
            ),
            if (authed && _unreadNotifications > 0)
              Positioned(
                right: 2,
                top: 2,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: GuestColors.popularRed,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  // Featured restaurant row removed — location chip is the primary selector.

  Widget _buildHero() {
    if (_banners.isNotEmpty) {
      return GuestBannerCarousel(
        banners: _banners,
        onTap: (b) {
          final type = b['linkType']?.toString() ?? 'none';
          final payload = b['linkPayload'] is Map
              ? Map<String, dynamic>.from(b['linkPayload'] as Map)
              : <String, dynamic>{};
          if (type == 'outlet' || type == 'storefront') {
            final orgSlug = payload['orgSlug']?.toString();
            final outletSlug = payload['outletSlug']?.toString();
            if (orgSlug != null && outletSlug != null) {
              context.push('/o/$orgSlug/$outletSlug');
              return;
            }
          }
          context.go('/explore');
        },
      );
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: GuestColors.primaryDeep,
        borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
        boxShadow: GuestSpacing.softShadow(color: GuestColors.primary),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -6,
            bottom: -10,
            child: Icon(
              Icons.ramen_dining_rounded,
              size: 96,
              color: Colors.white.withValues(alpha: 0.12),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Discover nearby',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Great food is closer than you think.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.88),
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () => context.go('/explore'),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Explore Restaurants',
                        style: TextStyle(
                          color: GuestColors.primaryDeep,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(Icons.arrow_forward_rounded,
                          size: 16, color: GuestColors.primaryDeep),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServiceGrid() {
    final items = [
      _ServiceItem(
        label: 'Dine In',
        subtitle: 'Find a table.',
        icon: Icons.restaurant_rounded,
        bg: const Color(0xFFFFF1E8),
        fg: const Color(0xFFE85D04),
        onTap: () => context.go('/explore?mode=dine_in'),
      ),
      _ServiceItem(
        label: 'Takeaway',
        subtitle: 'Order & pick up.',
        icon: Icons.shopping_bag_outlined,
        bg: GuestColors.primarySoft,
        fg: GuestColors.primary,
        onTap: () => context.go('/explore?mode=takeaway'),
      ),
      _ServiceItem(
        label: 'Delivery',
        subtitle: 'Food at your door.',
        icon: Icons.delivery_dining_rounded,
        bg: const Color(0xFFF3E8FF),
        fg: const Color(0xFF7C3AED),
        onTap: () => context.go('/explore?mode=delivery'),
      ),
      _ServiceItem(
        label: 'Offers',
        subtitle: _offers.isEmpty ? 'Best deals.' : '${_offers.length} deals.',
        icon: Icons.star_rounded,
        bg: GuestColors.coralSoft,
        fg: GuestColors.coralDeep,
        onTap: () => context.go('/explore?mode=offers'),
      ),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: items[i]),
        ],
      ],
    );
  }

  Widget _buildLoyalty() {
    final hasWallet = _memberships.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.workspace_premium_rounded,
                size: 18, color: Color(0xFFD97706)),
            const SizedBox(width: 6),
            const Expanded(
              child: Text(
                'Loyalty & Rewards',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
            ),
            TextButton(
              onPressed: () {
                final auth = ref.read(authControllerProvider);
                if (!auth.isAuthenticated) {
                  context.push(
                      '/login?next=${Uri.encodeComponent('/wallets')}');
                  return;
                }
                context.push('/wallets');
              },
              style: TextButton.styleFrom(
                foregroundColor: GuestColors.primary,
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'View All →',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (!hasWallet)
          GuestSoftCard(
            color: GuestColors.coralSoft,
            onTap: () {
              final auth = ref.read(authControllerProvider);
              if (!auth.isAuthenticated) {
                context.push('/login?next=${Uri.encodeComponent('/wallets')}');
                return;
              }
              context.push('/wallets');
            },
            child: const Row(
              children: [
                Icon(Icons.card_giftcard_rounded, color: Color(0xFFD97706)),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Earn rewards on every order',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Dine more. Get more.',
                        style: TextStyle(
                          fontSize: 12,
                          color: GuestColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          GuestSoftCard(
            onTap: () => context.push('/wallets'),
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Column(
              children: [
                for (var i = 0;
                    i < _memberships.take(3).length;
                    i++) ...[
                  if (i > 0)
                    const Divider(height: 12, color: GuestColors.borderLight),
                  Builder(builder: (_) {
                    final r = Map<String, dynamic>.from(
                        _memberships[i] as Map);
                    final org = Map<String, dynamic>.from(
                        r['organization'] as Map);
                    final pts = r['loyaltyPoints'] ?? 0;
                    return Row(
                      children: [
                        Expanded(
                          child: Text(
                            org['name']?.toString() ?? 'Restaurant',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
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
                  Text(
                    'View all ${_memberships.length} restaurants →',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                      color: GuestColors.primary,
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildCoinsCard(bool authed) {
    return GestureDetector(
      onTap: () {
        if (!authed) {
          context.push('/login?next=${Uri.encodeComponent('/coins')}');
          return;
        }
        context.push('/coins');
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF15803D), Color(0xFF166534)],
          ),
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF15803D).withValues(alpha: 0.28),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.monetization_on_rounded,
                color: Color(0xFFBEF264),
                size: 26,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Cullinos Coins',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    authed
                        ? 'Earn 10% on orders · Redeem coming soon'
                        : 'Sign in to start earning',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            if (authed)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$_coinsBalance',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              )
            else
              const Icon(Icons.chevron_right, color: Colors.white70),
          ],
        ),
      ),
    );
  }

  Widget _buildAllPlaces() {
    final restaurantCount = _outlets.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.location_on_rounded,
                size: 18, color: GuestColors.popularRed),
            const SizedBox(width: 6),
            const Expanded(
              child: Text(
                'All Places',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
            ),
            TextButton(
              onPressed: () => context.go('/explore'),
              style: TextButton.styleFrom(
                foregroundColor: GuestColors.primary,
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Explore →',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _PlaceCategoryCard(
                title: 'Restaurants',
                subtitle: 'Cafes, Fine Dining, Quick Bites',
                meta: restaurantCount > 0
                    ? '$restaurantCount+ places'
                    : 'Discover nearby',
                bg: const Color(0xFFFFE8DC),
                icon: Icons.restaurant_rounded,
                iconColor: const Color(0xFFE85D04),
                onTap: () => context.go('/explore?cuisine=Restaurant'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _PlaceCategoryCard(
                title: 'Cafes',
                subtitle: 'Coffee, Desserts, Hangout',
                meta: 'Browse cafes',
                bg: const Color(0xFFE8F4FF),
                icon: Icons.local_cafe_rounded,
                iconColor: const Color(0xFF0284C7),
                onTap: () => context.go('/explore?cuisine=Cafe'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _CircleIcon extends StatelessWidget {
  const _CircleIcon({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: GuestColors.surface,
      shape: const CircleBorder(),
      elevation: 0,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: GuestColors.border),
          ),
          child: Icon(icon, size: 20, color: GuestColors.ink),
        ),
      ),
    );
  }
}

class _ServiceItem extends StatelessWidget {
  const _ServiceItem({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.bg,
    required this.fg,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final IconData icon;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(6, 10, 6, 10),
        decoration: BoxDecoration(
          color: GuestColors.surface,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          boxShadow: GuestSpacing.cardShadow,
        ),
        child: Column(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: fg, size: 18),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 9,
                color: GuestColors.muted,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlaceCategoryCard extends StatelessWidget {
  const _PlaceCategoryCard({
    required this.title,
    required this.subtitle,
    required this.meta,
    required this.bg,
    required this.icon,
    required this.iconColor,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String meta;
  final Color bg;
  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: iconColor, size: 26),
            const SizedBox(height: 10),
            Text(
              title,
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 11,
                color: GuestColors.muted,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              meta,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: iconColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

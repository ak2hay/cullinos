import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/location/guest_location_controller.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_network_image.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class OffersPage extends ConsumerStatefulWidget {
  const OffersPage({super.key});

  @override
  ConsumerState<OffersPage> createState() => _OffersPageState();
}

class _OffersPageState extends ConsumerState<OffersPage> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _offers = [];
  List<Map<String, dynamic>> _banners = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(guestApiProvider);
      final loc = ref.read(guestLocationProvider).state;
      final offersRes = await api.offers(lat: loc.lat, lng: loc.lng);
      final bannersRes = await api.banners(lat: loc.lat, lng: loc.lng);
      final offerList = List<dynamic>.from(
        (offersRes['offers'] ?? offersRes['items'] ?? []) as List,
      );
      final bannerList = List<dynamic>.from(
        (bannersRes['banners'] ?? bannersRes['items'] ?? []) as List,
      );
      setState(() {
        _offers = offerList
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _banners = bannerList
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (e) {
      setState(() => _error = friendlyApiError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      body: SafeArea(
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GuestColors.primary),
              )
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
                            onPressed: _load,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
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
                        120,
                      ),
                      children: [
                        const Text(
                          'Special Offers',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 26,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Deals near you from Cullinos partners',
                          style: TextStyle(
                            color: GuestColors.muted,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 18),
                        if (_banners.isNotEmpty) ...[
                          const GuestSectionHeader(
                            title: 'Featured',
                            emoji: '✨',
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            height: 140,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: _banners.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 10),
                              itemBuilder: (_, i) {
                                final b = _banners[i];
                                final image = b['imageUrl']?.toString() ??
                                    b['image']?.toString();
                                final title = b['title']?.toString() ?? 'Offer';
                                return Container(
                                  width: 260,
                                  decoration: BoxDecoration(
                                    color: GuestColors.primaryDeep,
                                    borderRadius: BorderRadius.circular(
                                      GuestSpacing.radiusMd,
                                    ),
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      if (image != null && image.isNotEmpty)
                                        GuestNetworkImage(
                                          url: image,
                                          fit: BoxFit.cover,
                                        ),
                                      Container(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.bottomCenter,
                                            end: Alignment.topCenter,
                                            colors: [
                                              Colors.black.withValues(alpha: 0.65),
                                              Colors.transparent,
                                            ],
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        left: 14,
                                        right: 14,
                                        bottom: 14,
                                        child: Text(
                                          title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 15,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
                          const SizedBox(height: 22),
                        ],
                        const GuestSectionHeader(
                          title: 'All offers',
                          emoji: '🎟️',
                        ),
                        const SizedBox(height: 10),
                        if (_offers.isEmpty)
                          const GuestEmptyState(
                            icon: Icons.local_offer_outlined,
                            message:
                                'No offers right now. Check back soon — partners add new deals often.',
                          )
                        else
                          ..._offers.map((o) {
                            final title = o['title']?.toString() ??
                                o['code']?.toString() ??
                                'Offer';
                            final desc = o['description']?.toString() ??
                                o['subtitle']?.toString() ??
                                '';
                            final code = o['code']?.toString();
                            final orgSlug = o['orgSlug']?.toString() ??
                                (o['organization'] is Map
                                    ? (o['organization']
                                        as Map)['slug']
                                        ?.toString()
                                    : null);
                            final outletSlug = o['outletSlug']?.toString() ??
                                (o['outlet'] is Map
                                    ? (o['outlet'] as Map)['slug']?.toString()
                                    : null);
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: GuestSoftCard(
                                onTap: () async {
                                  if (code != null && code.isNotEmpty) {
                                    await Clipboard.setData(
                                        ClipboardData(text: code));
                                    if (!context.mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('Copied $code'),
                                        duration: const Duration(seconds: 2),
                                      ),
                                    );
                                  }
                                  if (orgSlug != null && outletSlug != null) {
                                    context.push('/o/$orgSlug/$outletSlug');
                                  }
                                },
                                child: Row(
                                  children: [
                                    Container(
                                      width: 48,
                                      height: 48,
                                      decoration: BoxDecoration(
                                        color: GuestColors.primarySoft,
                                        borderRadius: BorderRadius.circular(
                                          GuestSpacing.radiusSm,
                                        ),
                                      ),
                                      child: const Icon(
                                        Icons.local_offer_rounded,
                                        color: GuestColors.primary,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            title,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 15,
                                            ),
                                          ),
                                          if (desc.isNotEmpty) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              desc,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                color: GuestColors.muted,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ],
                                          if (code != null &&
                                              code.isNotEmpty) ...[
                                            const SizedBox(height: 6),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                horizontal: 8,
                                                vertical: 3,
                                              ),
                                              decoration: BoxDecoration(
                                                color: GuestColors.primarySoft,
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                code,
                                                style: const TextStyle(
                                                  color: GuestColors.primaryDeep,
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 11,
                                                  letterSpacing: 0.4,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    const Icon(
                                      Icons.chevron_right_rounded,
                                      color: GuestColors.muted,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
      ),
    );
  }
}

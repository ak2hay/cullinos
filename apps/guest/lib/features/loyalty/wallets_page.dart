import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class WalletsPage extends ConsumerStatefulWidget {
  const WalletsPage({super.key});

  @override
  ConsumerState<WalletsPage> createState() => _WalletsPageState();
}

class _WalletsPageState extends ConsumerState<WalletsPage> {
  List<dynamic> _rows = [];
  bool _loading = true;
  String? _error;
  String? _selectedOrgId;
  List<dynamic> _rewards = [];
  Map<String, dynamic>? _loyaltyMe;

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
      final rows = await ref.read(guestApiProvider).memberships();
      setState(() => _rows = rows);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _openOrg(Map<String, dynamic> row) async {
    final org = Map<String, dynamic>.from(row['organization'] as Map);
    final orgId = org['id'] as String;
    setState(() {
      _selectedOrgId = orgId;
      _rewards = [];
      _loyaltyMe = null;
    });
    try {
      final auth = ref.read(authControllerProvider);
      var token = await auth.customerToken(orgId);
      if (token == null) {
        final membership =
            await ref.read(guestApiProvider).ensureMembership(orgId);
        token = membership['customerAccessToken'] as String?;
        if (token != null) {
          await auth.saveCustomerToken(orgId, token);
        }
      }
      final rewards = await ref.read(guestApiProvider).loyaltyRewards(orgId);
      Map<String, dynamic>? me;
      if (token != null) {
        me = await ref.read(guestApiProvider).loyaltyMe(orgId, token);
      }
      setState(() {
        _rewards = rewards;
        _loyaltyMe = me;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    }
  }

  Future<void> _redeem(String rewardId) async {
    final orgId = _selectedOrgId;
    if (orgId == null) return;
    final token = await ref.read(authControllerProvider).customerToken(orgId);
    if (token == null) return;
    try {
      await ref.read(guestApiProvider).redeemReward(
            orgId: orgId,
            customerToken: token,
            rewardId: rewardId,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reward redeemed 🎉'),
            backgroundColor: GuestColors.primary,
          ),
        );
      }
      final row = _rows.cast<dynamic>().firstWhere(
            (r) =>
                Map<String, dynamic>.from(r as Map)['organization']['id'] ==
                orgId,
            orElse: () => null,
          );
      if (row != null) await _openOrg(Map<String, dynamic>.from(row as Map));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Redeem failed: $e')),
        );
      }
    }
  }

  // Build gradient for loyalty card — use primary-based gradients
  LinearGradient _loyaltyGradient(int index) {
    const gradients = [
      GuestColors.heroTeal,          // deep forest green
      GuestColors.promoTeal,         // bright forest green
      LinearGradient(               // warm amber for variety
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
      ),
      LinearGradient(               // deep teal-blue
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF0891B2), Color(0xFF0E7490)],
      ),
    ];
    return gradients[index % gradients.length];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        backgroundColor: GuestColors.scaffold,
        foregroundColor: GuestColors.ink,
        elevation: 0,
        leading: const GuestBackButton(fallbackPath: '/profile'),
        title: const Text(
          'Rewards',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
            color: GuestColors.primary,
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const GuestLoading()
            : _error != null
                ? Center(child: Text(_error!))
                : RefreshIndicator(
                    color: GuestColors.primary,
                    onRefresh: _load,
                    child: _rows.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 40),
                              GuestEmptyState(
                                message:
                                    'Visit a Cullinos place to start earning points.',
                                icon: Icons.card_giftcard_outlined,
                              ),
                            ],
                          )
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(
                              GuestSpacing.page,
                              8,
                              GuestSpacing.page,
                              110,
                            ),
                            children: [
                              const GuestSectionHeader(
                                title: 'Your memberships',
                                emoji: '🌿',
                              ),
                              const SizedBox(height: 12),
                              ...List.generate(_rows.length, (i) {
                                final r = Map<String, dynamic>.from(
                                  _rows[i] as Map,
                                );
                                final org = Map<String, dynamic>.from(
                                  r['organization'] as Map,
                                );
                                final selected =
                                    _selectedOrgId == org['id'];
                                final pts = r['loyaltyPoints'] ?? 0;
                                final stamps = r['stampCount'] ?? 0;

                                return Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 8),
                                  child: GuestSoftCard(
                                    onTap: () => _openOrg(r),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 10),
                                    color: selected
                                        ? GuestColors.primarySoft
                                        : null,
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 36,
                                          height: 36,
                                          decoration: BoxDecoration(
                                            gradient: _loyaltyGradient(i),
                                            borderRadius:
                                                BorderRadius.circular(10),
                                          ),
                                          child: const Icon(
                                            Icons.storefront_rounded,
                                            color: Colors.white,
                                            size: 18,
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                org['name']?.toString() ??
                                                    '',
                                                maxLines: 1,
                                                overflow:
                                                    TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontWeight:
                                                      FontWeight.w800,
                                                  fontSize: 14,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                '$pts pts · $stamps stamps',
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  color: GuestColors.muted,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if (selected)
                                          const Padding(
                                            padding:
                                                EdgeInsets.only(right: 4),
                                            child: Icon(
                                              Icons.check_circle_rounded,
                                              color: GuestColors.primary,
                                              size: 18,
                                            ),
                                          ),
                                        const Icon(
                                          Icons.chevron_right,
                                          color: GuestColors.muted,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              }),

                              // Rewards section
                              if (_selectedOrgId != null) ...[
                                const SizedBox(height: 8),
                                const GuestSectionHeader(
                                  title: 'Available rewards',
                                  emoji: '✨',
                                ),
                                const SizedBox(height: 10),

                                // Balance card
                                if (_loyaltyMe != null)
                                  Padding(
                                    padding:
                                        const EdgeInsets.only(bottom: 12),
                                    child: GuestSoftCard(
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 44,
                                            height: 44,
                                            decoration: const BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: GuestColors.primarySoft,
                                            ),
                                            child: const Icon(
                                              Icons.account_balance_wallet_outlined,
                                              color: GuestColors.primary,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'Your balance',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: GuestColors.muted,
                                                ),
                                              ),
                                              Text(
                                                '${_loyaltyMe!['points'] ?? _loyaltyMe!['loyaltyPoints'] ?? '—'} points',
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 20,
                                                  color: GuestColors.primary,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                if (_rewards.isEmpty)
                                  const GuestSoftCard(
                                    child: Row(
                                      children: [
                                        Icon(Icons.info_outline,
                                            color: GuestColors.muted,
                                            size: 18),
                                        SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            'No catalog rewards yet for this restaurant.',
                                            style: TextStyle(
                                                color: GuestColors.muted),
                                          ),
                                        ),
                                      ],
                                    ),
                                  )
                                else
                                  ..._rewards.map((raw) {
                                    final reward =
                                        Map<String, dynamic>.from(raw as Map);
                                    final pts = reward['pointsCost'] ??
                                        reward['points'] ??
                                        '—';
                                    return Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 12),
                                      child: GuestSoftCard(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  width: 36,
                                                  height: 36,
                                                  decoration: BoxDecoration(
                                                    color: GuestColors
                                                        .primarySoft,
                                                    borderRadius: BorderRadius
                                                        .circular(
                                                      GuestSpacing.radiusSm,
                                                    ),
                                                  ),
                                                  child: const Icon(
                                                    Icons.redeem_rounded,
                                                    color: GuestColors.primary,
                                                    size: 18,
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Text(
                                                        reward['name']
                                                                ?.toString() ??
                                                            'Reward',
                                                        style: const TextStyle(
                                                          fontWeight:
                                                              FontWeight.w800,
                                                        ),
                                                      ),
                                                      Text(
                                                        '$pts points',
                                                        style: const TextStyle(
                                                          color:
                                                              GuestColors.muted,
                                                          fontSize: 12,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 12),
                                            GuestPillButton(
                                              label: 'Redeem',
                                              icon: Icons.redeem_rounded,
                                              onPressed: () => _redeem(
                                                reward['id'].toString(),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }),
                              ],
                            ],
                          ),
                  ),
      ),
    );
  }
}

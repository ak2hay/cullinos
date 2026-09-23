import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class CoinsPage extends ConsumerStatefulWidget {
  const CoinsPage({super.key});

  @override
  ConsumerState<CoinsPage> createState() => _CoinsPageState();
}

class _CoinsPageState extends ConsumerState<CoinsPage> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  static const _green = Color(0xFF15803D);
  static const _greenDeep = Color(0xFF14532D);
  static const _greenLight = Color(0xFFDCFCE7);
  static const _greenBorder = Color(0xFFBBF7D0);

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
      final auth = ref.read(authControllerProvider);
      if (!auth.isAuthenticated) {
        setState(() => _data = {'balance': 0, 'ledger': []});
        return;
      }
      final data = await ref.read(guestApiProvider).coins();
      setState(() => _data = data);
    } catch (e) {
      setState(() => _error = friendlyApiError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = (_data?['balance'] as num?)?.toInt() ??
        (_data?['coins'] as num?)?.toInt() ??
        0;
    final ledger = List<dynamic>.from(
      (_data?['ledger'] ?? _data?['transactions'] ?? []) as List,
    );

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        backgroundColor: GuestColors.scaffold,
        foregroundColor: GuestColors.ink,
        elevation: 0,
        leading: const GuestBackButton(fallbackPath: '/profile'),
        title: const Text(
          'Cullinos Coins',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
            color: _green,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _green))
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
                  color: _green,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                      GuestSpacing.page,
                      8,
                      GuestSpacing.page,
                      110,
                    ),
                    children: [
                      // ── Hero coin balance card ──────────────────────────
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [_green, _greenDeep],
                          ),
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusMd),
                          boxShadow: [
                            BoxShadow(
                              color: _green.withValues(alpha: 0.35),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Stack(
                          children: [
                            Positioned(
                              right: -8,
                              top: -8,
                              child: Icon(
                                Icons.monetization_on_rounded,
                                size: 88,
                                color: Colors.white.withValues(alpha: 0.10),
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 36,
                                      height: 36,
                                      decoration: BoxDecoration(
                                        color:
                                            Colors.white.withValues(alpha: 0.2),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.monetization_on_rounded,
                                        color: Color(0xFFBEF264),
                                        size: 20,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    const Text(
                                      'Cullinos Coins',
                                      style: TextStyle(
                                        color: Colors.white70,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 18),
                                Text(
                                  '$balance',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 52,
                                    height: 1,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'coins balance',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      // ── Earn + Redeem info ───────────────────────────────
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: _greenLight,
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusMd),
                          border: Border.all(color: _greenBorder),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: _green.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.redeem_rounded,
                                color: _green,
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Redeem Cullinos Coins',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                      color: _greenDeep,
                                    ),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    'Coming soon — redeem coins for coupons',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: _green,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: _green.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                'Coming soon',
                                style: TextStyle(
                                  color: _green,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      // ── How to earn ──────────────────────────────────────
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: GuestColors.surface,
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusMd),
                          boxShadow: GuestSpacing.cardShadow,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'How to earn',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                color: _greenDeep,
                              ),
                            ),
                            const SizedBox(height: 12),
                            _earningRow(
                              icon: Icons.receipt_long_rounded,
                              text: 'Earn 10% coins on every paid order',
                            ),
                            const SizedBox(height: 8),
                            _earningRow(
                              icon: Icons.star_rounded,
                              text: 'Rate your dining experience',
                            ),
                            const SizedBox(height: 8),
                            _earningRow(
                              icon: Icons.restaurant_rounded,
                              text: 'Order at any Cullinos partner outlet',
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      // ── Activity ledger ──────────────────────────────────
                      const GuestSectionHeader(title: 'Activity', emoji: '📋'),
                      const SizedBox(height: 10),
                      if (ledger.isEmpty)
                        GuestSoftCard(
                          child: Row(
                            children: const [
                              Icon(Icons.history_rounded,
                                  color: GuestColors.muted),
                              SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'No activity yet. Place orders to earn coins.',
                                  style: TextStyle(color: GuestColors.muted),
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        ...ledger.map((raw) {
                          final entry =
                              Map<String, dynamic>.from(raw as Map);
                          final amount = (entry['delta'] as num?)?.toInt() ??
                              (entry['amount'] as num?)?.toInt() ??
                              0;
                          final desc = entry['reason']?.toString() ??
                              entry['description']?.toString() ??
                              entry['type']?.toString() ??
                              'Transaction';
                          final displayDesc = desc.startsWith('order:')
                              ? 'Order reward (10%)'
                              : desc;
                          final date = entry['createdAt']?.toString() ??
                              entry['date']?.toString();
                          final isCredit = amount >= 0;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: GuestSoftCard(
                              child: Row(
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: isCredit
                                          ? _greenLight
                                          : const Color(0xFFFFE4E6),
                                      borderRadius: BorderRadius.circular(
                                          GuestSpacing.radiusSm),
                                    ),
                                    child: Icon(
                                      isCredit
                                          ? Icons.add_circle_outline
                                          : Icons.remove_circle_outline,
                                      color: isCredit
                                          ? _green
                                          : GuestColors.popularRed,
                                      size: 18,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          displayDesc,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700),
                                        ),
                                        if (date != null)
                                          Text(
                                            _formatDate(date),
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: GuestColors.muted,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${isCredit ? '+' : ''}$amount',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color:
                                          isCredit ? _green : GuestColors.popularRed,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }

  Widget _earningRow({required IconData icon, required String text}) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: const Color(0xFF15803D).withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: const Color(0xFF15803D), size: 14),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: GuestColors.ink),
          ),
        ),
      ],
    );
  }

  String _formatDate(String isoDate) {
    final dt = DateTime.tryParse(isoDate);
    if (dt == null) return isoDate;
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/outlet/active_outlet_controller.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_empty_state.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class OrdersPage extends ConsumerStatefulWidget {
  const OrdersPage({super.key});

  @override
  ConsumerState<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends ConsumerState<OrdersPage>
    with SingleTickerProviderStateMixin {
  List<dynamic> _orders = [];
  bool _loading = true;
  String? _error;
  late TabController _tabs;

  static const _active = {
    'draft',
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'CREATED',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
  };
  static const _cancelled = {
    'cancelled',
    'rejected',
    'failed',
    'CANCELLED',
    'REJECTED',
    'FAILED',
  };

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final orders = await ref.read(guestApiProvider).orders();
      setState(() => _orders = orders);
    } catch (e) {
      setState(() => _error = friendlyApiError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  List<dynamic> _filter(int index) {
    return _orders.where((raw) {
      final o = Map<String, dynamic>.from(raw as Map);
      final status = (o['status']?.toString() ?? '').toLowerCase();
      final upper = o['status']?.toString() ?? '';
      if (index == 0) {
        return _active.contains(status) || _active.contains(upper);
      }
      if (index == 1) {
        return status.contains('complet') ||
            status.contains('deliver') ||
            upper == 'COMPLETED' ||
            upper == 'DELIVERED';
      }
      return _cancelled.contains(status) || _cancelled.contains(upper);
    }).toList();
  }

  /// Group a filtered list by outlet name.
  Map<String, List<dynamic>> _groupByOutlet(List<dynamic> orders) {
    final map = <String, List<dynamic>>{};
    for (final raw in orders) {
      final o = Map<String, dynamic>.from(raw as Map);
      final outlet = o['outlet'] is Map
          ? Map<String, dynamic>.from(o['outlet'] as Map)
          : null;
      final name = outlet?['name']?.toString() ?? 'Other';
      map.putIfAbsent(name, () => []).add(raw);
    }
    return map;
  }

  Color _statusColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('cancel') || s.contains('reject') || s.contains('fail')) {
      return GuestColors.popularRed;
    }
    if (s.contains('complet') || s.contains('deliver')) {
      return GuestColors.primary;
    }
    return GuestColors.coral;
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  void _handleBack() {
    if (context.canPop()) {
      context.pop();
      return;
    }
    final active = ref.read(activeOutletProvider).state;
    if (active.isActive) {
      context.go(active.outletPath);
      return;
    }
    context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    final active = ref.watch(activeOutletProvider).state;
    final fallback = active.isActive ? active.outletPath : '/';
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
      backgroundColor: GuestColors.scaffold,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                GuestSpacing.page - 8,
                8,
                GuestSpacing.page,
                0,
              ),
              child: Row(
                children: [
                  GuestBackButton(fallbackPath: fallback),
                  const Expanded(
                    child: GuestSectionHeader(title: 'Orders', emoji: '🧾'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            TabBar(
              controller: _tabs,
              labelColor: GuestColors.primary,
              unselectedLabelColor: GuestColors.muted,
              indicatorColor: GuestColors.primary,
              indicatorSize: TabBarIndicatorSize.label,
              labelStyle:
                  const TextStyle(fontWeight: FontWeight.w700),
              tabs: const [
                Tab(text: 'Active'),
                Tab(text: 'Completed'),
                Tab(text: 'Cancelled'),
              ],
            ),
            Expanded(
              child: _loading
                  ? const GuestLoading()
                  : _error != null
                      ? Center(child: Text(_error!))
                      : TabBarView(
                          controller: _tabs,
                          children: List.generate(3, (tabIndex) {
                            final rows = _filter(tabIndex);
                            return RefreshIndicator(
                              color: GuestColors.primary,
                              onRefresh: _load,
                              child: rows.isEmpty
                                  ? ListView(
                                      children: [
                                        const SizedBox(height: 40),
                                        GuestEmptyState(
                                          message: tabIndex == 0
                                              ? 'No active orders right now.'
                                              : 'No orders in this tab.',
                                          icon:
                                              Icons.receipt_long_outlined,
                                        ),
                                        const SizedBox(height: 20),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: GuestSpacing.page),
                                          child: Column(
                                            children: [
                                              OutlinedButton.icon(
                                                onPressed: () =>
                                                    context.go('/explore'),
                                                icon: const Icon(
                                                    Icons.explore_rounded),
                                                label:
                                                    const Text('Explore restaurants'),
                                                style:
                                                    OutlinedButton.styleFrom(
                                                  foregroundColor:
                                                      GuestColors.primary,
                                                  side: const BorderSide(
                                                      color:
                                                          GuestColors.primary),
                                                ),
                                              ),
                                              const SizedBox(height: 10),
                                              OutlinedButton.icon(
                                                onPressed: () =>
                                                    context.push('/scan'),
                                                icon: const Icon(
                                                    Icons.qr_code_scanner_rounded),
                                                label:
                                                    const Text('Scan a table QR'),
                                                style:
                                                    OutlinedButton.styleFrom(
                                                  foregroundColor:
                                                      GuestColors.muted,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    )
                                  : _buildGroupedList(rows),
                            );
                          }),
                        ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Widget _buildGroupedList(List<dynamic> rows) {
    final groups = _groupByOutlet(rows);
    final entries = groups.entries.toList();

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
          GuestSpacing.page, 12, GuestSpacing.page, 110),
      itemCount: entries.fold<int>(0, (sum, e) => sum + 1 + e.value.length),
      itemBuilder: (_, idx) {
        // Build flat list: header + items for each group
        var cursor = 0;
        for (final entry in entries) {
          if (idx == cursor) {
            // Section header
            return Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 6),
              child: Row(
                children: [
                  const Icon(Icons.storefront_rounded,
                      size: 15, color: GuestColors.muted),
                  const SizedBox(width: 6),
                  Text(
                    entry.key,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: GuestColors.muted,
                    ),
                  ),
                ],
              ),
            );
          }
          cursor++;
          for (var i = 0; i < entry.value.length; i++) {
            if (idx == cursor) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _buildOrderCard(entry.value[i]),
              );
            }
            cursor++;
          }
        }
        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildOrderCard(dynamic raw) {
    final o = Map<String, dynamic>.from(raw as Map);
    final outlet = o['outlet'] is Map
        ? Map<String, dynamic>.from(o['outlet'] as Map)
        : null;
    final status = o['status']?.toString() ?? '';
    final date = _formatDate(o['createdAt']?.toString());
    final type = o['type']?.toString();

    return GuestSoftCard(
      onTap: () => context.push('/orders/${o['id']}'),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: GuestColors.primarySoft,
              borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
            ),
            child: const Icon(Icons.receipt_long_rounded,
                color: GuestColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '#${o['orderNumber'] ?? o['id']}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                if (outlet?['name'] != null)
                  Text(
                    outlet!['name'].toString(),
                    style: const TextStyle(
                        color: GuestColors.muted, fontSize: 12),
                  ),
                const SizedBox(height: 4),
                _StatusChip(status: status, color: _statusColor(status)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${o['total']}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
              if (date.isNotEmpty)
                Text(
                  date,
                  style: const TextStyle(
                      fontSize: 11, color: GuestColors.muted),
                ),
              if (type != null)
                Text(
                  type,
                  style: const TextStyle(
                      fontSize: 11, color: GuestColors.muted),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status, required this.color});
  final String status;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 5),
          Text(
            status,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

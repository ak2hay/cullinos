import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/call_alert.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_socket.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/data/waiter_api.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/features/floor/selected_table.dart';
import 'package:cullinos_waiter/features/order/table_detail_page.dart';
import 'package:cullinos_waiter/features/orders/orders_hub_page.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/waiter_soft_card.dart';

final tablesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final outletId = ref.watch(authControllerProvider).selectedOutletId;
  if (outletId == null) return [];
  final rows = await ref.read(waiterApiProvider).tables(outletId);
  return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
});

final callsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final outletId = ref.watch(authControllerProvider).selectedOutletId;
  if (outletId == null) return [];
  final rows = await ref.read(waiterApiProvider).serviceRequests(outletId);
  return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
});

final outletsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final rows = await ref.read(waiterApiProvider).outlets();
  return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
});

class FloorPage extends ConsumerStatefulWidget {
  const FloorPage({super.key});

  @override
  ConsumerState<FloorPage> createState() => _FloorPageState();
}

class _FloorPageState extends ConsumerState<FloorPage> {
  String? _banner;
  String _floorFilter = 'all';
  late final WaiterSocketHandler _onCall;
  late final WaiterSocketHandler _onTable;
  late final WaiterSocketHandler _onReady;

  @override
  void initState() {
    super.initState();
    _onCall = (_) {
      ref.invalidate(callsProvider);
      ref.invalidate(tablesProvider);
      ref.read(callAlertServiceProvider).notifyNewCall();
      if (!mounted) return;
      setState(() => _banner = 'call');
      Future.delayed(const Duration(seconds: 8), () {
        if (mounted) setState(() => _banner = null);
      });
    };
    _onTable = (data) {
      ref.invalidate(tablesProvider);
      // Also treat order.updated with READY as a ready alert
      if (data is Map) {
        final status = data['status']?.toString().toUpperCase();
        if (status == 'READY') {
          _notifyReady(data);
        }
      }
    };
    _onReady = (data) {
      ref.invalidate(tablesProvider);
      _notifyReady(data);
    };
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sock = ref.read(waiterSocketProvider);
      sock.on('service_request.created', _onCall);
      sock.on('service_request.updated', _onCall);
      sock.on('table.updated', _onTable);
      sock.on('order.updated', _onTable);
      sock.on('order.ready', _onReady);
      sock.on('kot.created', _onTable);
    });
  }

  void _notifyReady(dynamic data) {
    ref.read(callAlertServiceProvider).notifyNewCall();
    ref.invalidate(openOrdersProvider);
    if (!mounted) return;
    String label = 'Order ready';
    if (data is Map) {
      final num = data['orderNumber']?.toString();
      final table = data['tableName']?.toString() ??
          data['table']?.toString();
      if (num != null && table != null) {
        label = 'Order #$num ready · $table';
      } else if (num != null) {
        label = 'Order #$num ready';
      }
    }
    setState(() => _banner = label);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(label),
        backgroundColor: WaiterColors.primary,
      ),
    );
    Future.delayed(const Duration(seconds: 10), () {
      if (mounted && _banner == label) setState(() => _banner = null);
    });
  }

  @override
  void dispose() {
    final sock = ref.read(waiterSocketProvider);
    sock.off('service_request.created', _onCall);
    sock.off('service_request.updated', _onCall);
    sock.off('table.updated', _onTable);
    sock.off('order.updated', _onTable);
    sock.off('order.ready', _onReady);
    sock.off('kot.created', _onTable);
    super.dispose();
  }

  String _statusLabel(AppLocalizations l10n, String status) {
    switch (status.toUpperCase()) {
      case 'AVAILABLE':
        return l10n.statusAvailable;
      case 'OCCUPIED':
        return l10n.statusOccupied;
      case 'RESERVED':
        return l10n.statusReserved;
      case 'CLEANING':
        return l10n.statusCleaning;
      case 'BILLING':
        return l10n.statusBilling;
      default:
        return status;
    }
  }

  void _openTable(String id, {required bool wide}) {
    ref.read(selectedTableProvider).select(id);
    if (!wide) {
      context.push('/table/$id');
    }
  }

  String? _floorIdOf(Map<String, dynamic> t) {
    final section = t['section'];
    if (section is! Map) return null;
    final floor = section['floor'];
    if (floor is! Map) return null;
    return floor['id']?.toString();
  }

  String? _floorNameOf(Map<String, dynamic> t) {
    final section = t['section'];
    if (section is! Map) return null;
    final floor = section['floor'];
    if (floor is! Map) return null;
    return floor['name']?.toString();
  }

  List<({String id, String name})> _floorsFrom(List<Map<String, dynamic>> tables) {
    final map = <String, String>{};
    final order = <String>[];
    for (final t in tables) {
      final id = _floorIdOf(t);
      final name = _floorNameOf(t);
      if (id == null || name == null) continue;
      if (!map.containsKey(id)) {
        map[id] = name;
        order.add(id);
      }
    }
    return order.map((id) => (id: id, name: map[id]!)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final tablesAsync = ref.watch(tablesProvider);
    final callsAsync = ref.watch(callsProvider);
    final outletsAsync = ref.watch(outletsProvider);
    final selectedId = ref.watch(selectedTableProvider).tableId;
    final wide = MediaQuery.sizeOf(context).width >= 900;

    final callMap = <String, Map<String, dynamic>>{};
    for (final c in callsAsync.valueOrNull ?? const []) {
      final tid = c['tableId']?.toString();
      if (tid != null) callMap[tid] = c;
    }

    Widget grid = tablesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(friendlyDioError(e))),
      data: (tables) {
        final floors = _floorsFrom(tables);
        final filtered = _floorFilter == 'all'
            ? tables
            : tables.where((t) => _floorIdOf(t) == _floorFilter).toList();

        if (tables.isEmpty) {
          return Center(child: Text(l10n.emptyFloor));
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (floors.isNotEmpty)
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(
                    WaiterSpacing.page,
                    8,
                    WaiterSpacing.page,
                    0,
                  ),
                  children: [
                    _FloorChip(
                      label: l10n.allFloors,
                      selected: _floorFilter == 'all',
                      onTap: () => setState(() => _floorFilter = 'all'),
                    ),
                    ...floors.map(
                      (f) => Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: _FloorChip(
                          label: f.name,
                          selected: _floorFilter == f.id,
                          onTap: () => setState(() => _floorFilter = f.id),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        l10n.emptyFloor,
                        textAlign: TextAlign.center,
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.all(WaiterSpacing.page),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: wide ? 3 : 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: wide ? 1.35 : 1.15,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) {
                        final t = filtered[i];
                        final id = t['id']?.toString() ?? '';
                        final status = t['status']?.toString() ?? 'AVAILABLE';
                        final call = callMap[id];
                        final color = WaiterColors.statusColor(status);
                        final section = (t['section'] is Map)
                            ? (t['section'] as Map)['name']?.toString()
                            : null;
                        final floorName = _floorNameOf(t);
                        final selected = wide && selectedId == id;
                        return WaiterSoftCard(
                          onTap: () => _openTable(id, wide: wide),
                          child: DecoratedBox(
                            decoration: selected
                                ? BoxDecoration(
                                    border: Border.all(
                                        color: WaiterColors.primary, width: 2),
                                    borderRadius: BorderRadius.circular(12),
                                  )
                                : const BoxDecoration(),
                            child: Padding(
                              padding: selected
                                  ? const EdgeInsets.all(4)
                                  : EdgeInsets.zero,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          t['name']?.toString() ?? 'Table',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 18,
                                          ),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: color.withValues(alpha: 0.12),
                                          borderRadius:
                                              BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          _statusLabel(l10n, status),
                                          style: TextStyle(
                                            color: color,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (floorName != null || section != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      [
                                        if (floorName != null) floorName,
                                        if (section != null) section,
                                      ].join(' · '),
                                      style: const TextStyle(
                                          color: WaiterColors.muted),
                                    ),
                                  ],
                                  const Spacer(),
                                  if (call != null)
                                    Text(
                                      '${l10n.callingWaiter} · ${call['type'] ?? 'waiter'}',
                                      style: const TextStyle(
                                        color: WaiterColors.coralDeep,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );

    final allTables = tablesAsync.valueOrNull ?? const <Map<String, dynamic>>[];
    final occupiedCount = allTables
        .where((t) =>
            (t['status']?.toString() ?? '').toUpperCase() == 'OCCUPIED' ||
            (t['status']?.toString() ?? '').toUpperCase() == 'BILLING')
        .length;
    final availableCount = allTables
        .where(
            (t) => (t['status']?.toString() ?? '').toUpperCase() == 'AVAILABLE')
        .length;

    final left = Column(
      children: [
        if (_banner != null)
          Material(
            color: _banner == 'call'
                ? WaiterColors.coral
                : WaiterColors.primary,
            child: ListTile(
              title: Text(
                _banner == 'call' ? l10n.newTableCall : _banner!,
                style: const TextStyle(color: Colors.white),
              ),
              trailing: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => setState(() => _banner = null),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            WaiterSpacing.page,
            12,
            WaiterSpacing.page,
            0,
          ),
          child: Row(
            children: [
              Expanded(
                child: _StatTile(
                  label: 'Total',
                  value: '${allTables.length}',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatTile(
                  label: l10n.statusOccupied,
                  value: '$occupiedCount',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatTile(
                  label: l10n.statusAvailable,
                  value: '$availableCount',
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              for (final s in [
                ('AVAILABLE', l10n.statusAvailable),
                ('OCCUPIED', l10n.statusOccupied),
                ('BILLING', l10n.statusBilling),
                ('RESERVED', l10n.statusReserved),
              ])
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: WaiterColors.statusColor(s.$1),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(s.$2,
                        style: const TextStyle(
                            fontSize: 11, color: WaiterColors.muted)),
                  ],
                ),
            ],
          ),
        ),
        Expanded(child: grid),
      ],
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6F8),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(auth.name ?? l10n.tables,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(
              l10n.tables,
              style: const TextStyle(
                fontSize: 12,
                color: WaiterColors.muted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          outletsAsync.when(
            data: (outlets) {
              final current = auth.selectedOutletId;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: outlets.any((o) => o['id'] == current)
                        ? current
                        : (outlets.isNotEmpty
                            ? outlets.first['id']?.toString()
                            : null),
                    hint: Text(l10n.selectOutlet),
                    items: outlets
                        .map(
                          (o) => DropdownMenuItem(
                            value: o['id']?.toString(),
                            child: Text(o['name']?.toString() ?? ''),
                          ),
                        )
                        .toList(),
                    onChanged: (id) async {
                      await ref.read(authControllerProvider).setOutlet(id);
                      ref.read(selectedTableProvider).clear();
                      setState(() => _floorFilter = 'all');
                      ref.invalidate(tablesProvider);
                      ref.invalidate(callsProvider);
                    },
                  ),
                ),
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: wide
          ? Row(
              children: [
                Expanded(flex: 5, child: left),
                const VerticalDivider(width: 1),
                Expanded(
                  flex: 6,
                  child: selectedId == null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              l10n.selectTableHint,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: WaiterColors.muted,
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        )
                      : TableDetailPage(
                          key: ValueKey(selectedId),
                          tableId: selectedId,
                          embedded: true,
                        ),
                ),
              ],
            )
          : left,
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 11, color: WaiterColors.muted)),
          Text(value,
              style:
                  const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        ],
      ),
    );
  }
}

class _FloorChip extends StatelessWidget {
  const _FloorChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? WaiterColors.primary : WaiterColors.surface,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : WaiterColors.ink,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

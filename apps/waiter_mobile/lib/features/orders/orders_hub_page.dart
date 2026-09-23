import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/money.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/data/waiter_api.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/waiter_soft_card.dart';

enum _OrderFilter { all, preparing, ready, draft }

final openOrdersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final outletId = ref.watch(authControllerProvider).selectedOutletId;
  if (outletId == null) return [];
  final res = await ref.read(waiterApiProvider).listOrders(
        outletId: outletId,
        status: 'CONFIRMED,DRAFT,PREPARING,READY',
      );
  final data = res['data'] as List? ?? [];
  return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
});

class OrdersHubPage extends ConsumerStatefulWidget {
  const OrdersHubPage({super.key});

  @override
  ConsumerState<OrdersHubPage> createState() => _OrdersHubPageState();
}

class _OrdersHubPageState extends ConsumerState<OrdersHubPage> {
  _OrderFilter _filter = _OrderFilter.all;

  String _fmtTime(String? iso) {
    if (iso == null) return '';
    final t = DateTime.tryParse(iso)?.toLocal();
    if (t == null) return '';
    return DateFormat('d MMM · h:mm a').format(t);
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'READY':
        return WaiterColors.primary;
      case 'PREPARING':
      case 'CONFIRMED':
        return const Color(0xFFE67E22);
      case 'DRAFT':
        return WaiterColors.muted;
      default:
        return WaiterColors.ink;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(openOrdersProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF5F6F8),
      appBar: AppBar(
        title: Text(l10n.orders),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(friendlyDioError(e))),
        data: (orders) {
          final filtered = orders.where((o) {
            final s = (o['status']?.toString() ?? '').toUpperCase();
            switch (_filter) {
              case _OrderFilter.all:
                return true;
              case _OrderFilter.preparing:
                return s == 'PREPARING' || s == 'CONFIRMED';
              case _OrderFilter.ready:
                return s == 'READY';
              case _OrderFilter.draft:
                return s == 'DRAFT';
            }
          }).toList();

          return Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Row(
                  children: [
                    for (final f in _OrderFilter.values) ...[
                      ChoiceChip(
                        label: Text(switch (f) {
                          _OrderFilter.all => l10n.filterAll,
                          _OrderFilter.preparing => 'Preparing',
                          _OrderFilter.ready => 'Ready',
                          _OrderFilter.draft => 'Draft',
                        }),
                        selected: _filter == f,
                        onSelected: (_) => setState(() => _filter = f),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(child: Text(l10n.emptyOrders))
                    : ListView.separated(
                        padding: const EdgeInsets.all(WaiterSpacing.page),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final o = filtered[i];
                          final tableId = o['tableId']?.toString();
                          final status =
                              (o['status']?.toString() ?? '').toUpperCase();
                          final tableName =
                              o['tableName']?.toString() ?? '—';
                          return WaiterSoftCard(
                            onTap: tableId == null
                                ? null
                                : () => context.push('/table/$tableId'),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '#${o['orderNumber'] ?? o['id']} · Table $tableName',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 16,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _fmtTime(o['createdAt']?.toString()),
                                        style: const TextStyle(
                                          color: WaiterColors.muted,
                                          fontSize: 12,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: _statusColor(status)
                                              .withValues(alpha: 0.12),
                                          borderRadius:
                                              BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          status,
                                          style: TextStyle(
                                            color: _statusColor(status),
                                            fontWeight: FontWeight.w800,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      formatInr(o['subtotal'] as num?),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 16,
                                      ),
                                    ),
                                    if (status == 'READY') ...[
                                      const SizedBox(height: 8),
                                      FilledButton(
                                        style: FilledButton.styleFrom(
                                          visualDensity: VisualDensity.compact,
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 12),
                                        ),
                                        onPressed: () async {
                                          try {
                                            await ref
                                                .read(waiterApiProvider)
                                                .updateOrderStatus(
                                                  o['id'].toString(),
                                                  'SERVED',
                                                );
                                            ref.invalidate(openOrdersProvider);
                                          } catch (e) {
                                            if (context.mounted) {
                                              ScaffoldMessenger.of(context)
                                                  .showSnackBar(
                                                SnackBar(
                                                  content: Text(
                                                      friendlyDioError(e)),
                                                ),
                                              );
                                            }
                                          }
                                        },
                                        child: const Text('Served'),
                                      ),
                                    ] else
                                      const Icon(Icons.chevron_right,
                                          color: WaiterColors.muted),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

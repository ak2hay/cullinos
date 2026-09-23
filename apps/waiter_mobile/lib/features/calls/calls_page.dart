import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/data/waiter_api.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/features/floor/floor_page.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/waiter_soft_card.dart';

enum _CallFilter { all, open, acknowledged }

class CallsPage extends ConsumerStatefulWidget {
  const CallsPage({super.key});

  @override
  ConsumerState<CallsPage> createState() => _CallsPageState();
}

class _CallsPageState extends ConsumerState<CallsPage> {
  _CallFilter _filter = _CallFilter.open;

  String _age(String? iso) {
    if (iso == null) return '';
    final t = DateTime.tryParse(iso);
    if (t == null) return '';
    final m = DateTime.now().difference(t.toLocal()).inMinutes;
    if (m < 1) return 'now';
    if (m < 60) return '${m}m';
    return '${m ~/ 60}h';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final outletId = ref.watch(authControllerProvider).selectedOutletId;
    final callsAsync = ref.watch(callsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6F8),
      appBar: AppBar(
        title: Text(l10n.calls),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: callsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(friendlyDioError(e))),
        data: (calls) {
          final filtered = calls.where((c) {
            final status = (c['status']?.toString() ?? 'open').toLowerCase();
            switch (_filter) {
              case _CallFilter.open:
                return status == 'open';
              case _CallFilter.acknowledged:
                return status == 'acknowledged';
              case _CallFilter.all:
                return true;
            }
          }).toList();

          return Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Row(
                  children: [
                    ChoiceChip(
                      label: Text(l10n.filterOpen),
                      selected: _filter == _CallFilter.open,
                      onSelected: (_) =>
                          setState(() => _filter = _CallFilter.open),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: Text(l10n.filterAcknowledged),
                      selected: _filter == _CallFilter.acknowledged,
                      onSelected: (_) =>
                          setState(() => _filter = _CallFilter.acknowledged),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: Text(l10n.filterAll),
                      selected: _filter == _CallFilter.all,
                      onSelected: (_) =>
                          setState(() => _filter = _CallFilter.all),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(child: Text(l10n.emptyCalls))
                    : ListView.separated(
                        padding: const EdgeInsets.all(WaiterSpacing.page),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) {
                          final c = filtered[i];
                          final id = c['id']?.toString() ?? '';
                          final status =
                              (c['status']?.toString() ?? 'open').toLowerCase();
                          final note = c['note']?.toString().trim();
                          final tableLabel =
                              c['tableName']?.toString() ?? 'Table';
                          return WaiterSoftCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        border: Border.all(
                                            color: WaiterColors.ink
                                                .withValues(alpha: 0.2)),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        tableLabel,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    const Spacer(),
                                    Text(
                                      _age(c['createdAt']?.toString()),
                                      style: const TextStyle(
                                        color: WaiterColors.muted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  '${c['type'] ?? 'waiter'} · $status',
                                  style: const TextStyle(
                                    color: WaiterColors.muted,
                                    fontSize: 13,
                                  ),
                                ),
                                if (note != null && note.isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    '"$note"',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 14),
                                if (status == 'open')
                                  FilledButton(
                                    style: FilledButton.styleFrom(
                                      minimumSize: const Size.fromHeight(48),
                                    ),
                                    onPressed: outletId == null
                                        ? null
                                        : () async {
                                            await ref
                                                .read(waiterApiProvider)
                                                .acknowledgeCall(
                                                  outletId,
                                                  id,
                                                );
                                            ref.invalidate(callsProvider);
                                          },
                                    child: Text(l10n.acknowledge),
                                  )
                                else
                                  OutlinedButton(
                                    style: OutlinedButton.styleFrom(
                                      minimumSize: const Size.fromHeight(48),
                                    ),
                                    onPressed: outletId == null
                                        ? null
                                        : () async {
                                            await ref
                                                .read(waiterApiProvider)
                                                .resolveCall(outletId, id);
                                            ref.invalidate(callsProvider);
                                            ref.invalidate(tablesProvider);
                                          },
                                    child: Text(l10n.done),
                                  ),
                                if (status == 'open') ...[
                                  const SizedBox(height: 8),
                                  OutlinedButton(
                                    onPressed: outletId == null
                                        ? null
                                        : () async {
                                            await ref
                                                .read(waiterApiProvider)
                                                .resolveCall(outletId, id);
                                            ref.invalidate(callsProvider);
                                            ref.invalidate(tablesProvider);
                                          },
                                    child: Text(l10n.done),
                                  ),
                                ],
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

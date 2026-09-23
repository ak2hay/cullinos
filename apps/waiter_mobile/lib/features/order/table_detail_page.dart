import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/money.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/data/waiter_api.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/features/floor/floor_page.dart';
import 'package:cullinos_waiter/features/order/collect_payment_sheet.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/waiter_section_header.dart';
import 'package:cullinos_waiter/widgets/waiter_soft_card.dart';

class _StageLine {
  _StageLine({
    required this.menuItemId,
    required this.name,
    required this.unitPrice,
    this.quantity = 1,
    this.variantId,
    this.modifiers,
    this.notes,
  });

  final String menuItemId;
  final String name;
  final double unitPrice;
  int quantity;
  String? variantId;
  List<Map<String, dynamic>>? modifiers;
  String? notes;
}

class TableDetailPage extends ConsumerStatefulWidget {
  const TableDetailPage({
    super.key,
    required this.tableId,
    this.embedded = false,
  });
  final String tableId;
  final bool embedded;

  @override
  ConsumerState<TableDetailPage> createState() => _TableDetailPageState();
}

class _TableDetailPageState extends ConsumerState<TableDetailPage> {
  Map<String, dynamic>? _table;
  Map<String, dynamic>? _order;
  Map<String, dynamic>? _session;
  Map<String, dynamic>? _menu;
  Map<String, dynamic>? _balance;
  final List<_StageLine> _staged = [];
  final _orderNotes = TextEditingController();
  final _search = TextEditingController();
  String? _categoryId;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void didUpdateWidget(covariant TableDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tableId != widget.tableId) {
      _staged.clear();
      _reload();
    }
  }

  @override
  void dispose() {
    _orderNotes.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    final outletId = ref.read(authControllerProvider).selectedOutletId;
    if (outletId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(waiterApiProvider);
      final tables = await api.tables(outletId);
      final table = tables
          .map((e) => Map<String, dynamic>.from(e as Map))
          .firstWhere((t) => t['id'] == widget.tableId, orElse: () => {});
      final ordersRes = await api.listOrders(outletId: outletId, tableId: widget.tableId);
      final orders = (ordersRes['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .where((o) {
        final s = (o['status']?.toString() ?? '').toUpperCase();
        return s != 'COMPLETED' && s != 'CANCELLED' && s != 'VOIDED';
      }).toList();
      Map<String, dynamic>? order;
      if (orders.isNotEmpty) {
        order = await api.getOrder(orders.first['id'].toString());
      }
      Map<String, dynamic>? session;
      try {
        session = await api.activeSession(outletId, widget.tableId);
      } catch (_) {
        session = null;
      }
      final menu = await api.menu(outletId);
      Map<String, dynamic>? balance;
      if (order != null) {
        try {
          balance = await api.orderBalance(order['id'].toString());
        } catch (_) {
          balance = null;
        }
      }
      if (!mounted) return;
      setState(() {
        _table = table.isEmpty ? null : table;
        _order = order;
        _session = session;
        _menu = menu;
        _balance = balance;
      });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyDioError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _categories {
    final cats = _menu?['categories'] as List? ?? [];
    return cats.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  List<Map<String, dynamic>> get _items {
    final items = (_menu?['items'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .where((i) => i['isAvailable'] != false)
        .toList();
    final q = _search.text.trim().toLowerCase();
    return items.where((i) {
      if (_categoryId != null && i['categoryId']?.toString() != _categoryId) {
        return false;
      }
      if (q.isEmpty) return true;
      return (i['name']?.toString() ?? '').toLowerCase().contains(q);
    }).toList();
  }

  Future<void> _setStatus(String status) async {
    final outletId = ref.read(authControllerProvider).selectedOutletId;
    if (outletId == null) return;
    try {
      await ref.read(waiterApiProvider).updateTableStatus(
            outletId,
            widget.tableId,
            status,
          );
      ref.invalidate(tablesProvider);
      await _reload();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDioError(e))),
        );
      }
    }
  }

  Future<void> _customizeAndAdd(Map<String, dynamic> item) async {
    final l10n = AppLocalizations.of(context);
    final variants = (item['variants'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final groups = (item['modifierGroups'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    String? variantId = variants.isNotEmpty ? variants.first['id']?.toString() : null;
    double pricePaise = (item['price'] as num?)?.toDouble() ?? 0;
    if (variants.isNotEmpty) {
      pricePaise = (variants.first['price'] as num?)?.toDouble() ?? pricePaise;
    }
    final selectedMods = <Map<String, dynamic>>[];
    final notesCtrl = TextEditingController();
    int qty = 1;

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(item['name']?.toString() ?? '',
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 18)),
                    if (variants.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        children: variants.map((v) {
                          final id = v['id']?.toString();
                          final selected = variantId == id;
                          return ChoiceChip(
                            label: Text(
                                '${v['name']} · ${formatInr(v['price'] as num?)}'),
                            selected: selected,
                            onSelected: (_) => setModal(() {
                              variantId = id;
                              pricePaise =
                                  (v['price'] as num?)?.toDouble() ?? pricePaise;
                            }),
                          );
                        }).toList(),
                      ),
                    ],
                    for (final g in groups) ...[
                      const SizedBox(height: 12),
                      Text(g['name']?.toString() ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      ...(g['modifiers'] as List? ?? []).map((raw) {
                        final m = Map<String, dynamic>.from(raw as Map);
                        final mid = m['id']?.toString();
                        final selected =
                            selectedMods.any((x) => x['modifierId'] == mid);
                        return CheckboxListTile(
                          dense: true,
                          value: selected,
                          title: Text(
                              '${m['name']} (+${formatInr(m['price'] as num?)})'),
                          onChanged: (v) => setModal(() {
                            if (v == true) {
                              selectedMods.add({
                                'name': m['name'],
                                'price': m['price'],
                                'modifierId': mid,
                              });
                            } else {
                              selectedMods
                                  .removeWhere((x) => x['modifierId'] == mid);
                            }
                          }),
                        );
                      }),
                    ],
                    TextField(
                      controller: notesCtrl,
                      decoration: InputDecoration(labelText: l10n.itemNotes),
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => setModal(() {
                            if (qty > 1) qty--;
                          }),
                          icon: const Icon(Icons.remove),
                        ),
                        Text('$qty'),
                        IconButton(
                          onPressed: () => setModal(() => qty++),
                          icon: const Icon(Icons.add),
                        ),
                      ],
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: Text(l10n.addItems),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
    if (ok == true) {
      setState(() {
        _staged.add(_StageLine(
          menuItemId: item['id'].toString(),
          name: item['name']?.toString() ?? 'Item',
          unitPrice: pricePaise +
              selectedMods.fold<double>(
                  0, (s, m) => s + ((m['price'] as num?)?.toDouble() ?? 0)),
          quantity: qty,
          variantId: variantId,
          modifiers: selectedMods.isEmpty ? null : List.from(selectedMods),
          notes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
        ));
      });
    }
    notesCtrl.dispose();
  }

  Future<void> _sendStaged() async {
    final outletId = ref.read(authControllerProvider).selectedOutletId;
    if (outletId == null || _staged.isEmpty) return;
    final items = _staged
        .map((l) => {
              'menuItemId': l.menuItemId,
              'quantity': l.quantity,
              if (l.variantId != null) 'variantId': l.variantId,
              if (l.modifiers != null) 'modifiers': l.modifiers,
              if (l.notes != null) 'notes': l.notes,
            })
        .toList();
    try {
      final api = ref.read(waiterApiProvider);
      if (_order == null) {
        await api.quickOrder(
          outletId: outletId,
          tableId: widget.tableId,
          items: items,
          notes: _orderNotes.text.trim().isEmpty ? null : _orderNotes.text.trim(),
        );
      } else {
        await api.addItems(_order!['id'].toString(), items);
      }
      setState(() => _staged.clear());
      await _reload();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDioError(e))),
        );
      }
    }
  }

  Future<void> _confirm() async {
    if (_order == null) return;
    try {
      await ref.read(waiterApiProvider).confirmOrder(_order!['id'].toString());
      await _reload();
      ref.invalidate(tablesProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDioError(e))),
        );
      }
    }
  }

  Future<void> _markServed() async {
    if (_order == null) return;
    try {
      await ref
          .read(waiterApiProvider)
          .updateOrderStatus(_order!['id'].toString(), 'SERVED');
      await _reload();
      ref.invalidate(tablesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Marked as served')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDioError(e))),
        );
      }
    }
  }

  Future<void> _startQr() async {
    final outletId = ref.read(authControllerProvider).selectedOutletId;
    if (outletId == null) return;
    try {
      final session = await ref
          .read(waiterApiProvider)
          .startSession(outletId, widget.tableId);
      setState(() => _session = session);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) {
          final l10n = AppLocalizations.of(context);
          final url = session['qrUrl']?.toString() ?? '';
          final tableName = _table?['name']?.toString() ?? 'Table';
          return AlertDialog(
            title: Text(l10n.showQr),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Let the customer scan to view the menu and place an order',
                  style: const TextStyle(fontSize: 13, color: WaiterColors.muted),
                ),
                const SizedBox(height: 12),
                if (url.isNotEmpty)
                  SizedBox(
                    width: 220,
                    height: 220,
                    child: QrImageView(data: url, size: 220),
                  ),
                const SizedBox(height: 8),
                Text(
                  tableName,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                SelectableText(url, style: const TextStyle(fontSize: 11)),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: url));
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text(l10n.copyLink)),
                    );
                  }
                },
                child: Text(l10n.copyLink),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('OK'),
              ),
            ],
          );
        },
      );
      ref.invalidate(tablesProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDioError(e))),
        );
      }
    }
  }

  Future<void> _endSession() async {
    final outletId = ref.read(authControllerProvider).selectedOutletId;
    final sid = _session?['id']?.toString();
    if (outletId == null || sid == null) return;
    await ref.read(waiterApiProvider).closeSession(outletId, widget.tableId, sid);
    await _reload();
  }

  Future<void> _transferOrMerge({required bool merge}) async {
    final outletId = ref.read(authControllerProvider).selectedOutletId;
    if (outletId == null) return;
    final tables = await ref.read(waiterApiProvider).tables(outletId);
    final others = tables
        .map((e) => Map<String, dynamic>.from(e as Map))
        .where((t) => t['id'] != widget.tableId)
        .toList();
    if (!mounted) return;
    final selected = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text(merge
            ? AppLocalizations.of(context).mergeTables
            : AppLocalizations.of(context).transferTable),
        children: others
            .map(
              (t) => SimpleDialogOption(
                onPressed: () => Navigator.pop(ctx, t['id']?.toString()),
                child: Text(t['name']?.toString() ?? ''),
              ),
            )
            .toList(),
      ),
    );
    if (selected == null) return;
    try {
      final api = ref.read(waiterApiProvider);
      if (merge) {
        await api.mergeTables(
          outletId,
          primaryTableId: widget.tableId,
          otherTableIds: [selected],
        );
      } else {
        await api.transferTable(
          outletId,
          fromTableId: widget.tableId,
          toTableId: selected,
        );
      }
      await _reload();
      ref.invalidate(tablesProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDioError(e))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(_error!)),
      );
    }
    final status = _table?['status']?.toString() ?? 'AVAILABLE';
    final orderStatus = (_order?['status']?.toString() ?? '').toUpperCase();
    final stagedTotal =
        _staged.fold<double>(0, (s, l) => s + l.unitPrice * l.quantity);

    final remaining = (_balance?['remaining'] as num?)?.toDouble() ?? 0;
    final unpaid = _order != null && remaining > 0.009;

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        title: Text(_table?['name']?.toString() ?? 'Table'),
        actions: [
          IconButton(
            tooltip: l10n.startQrSession,
            onPressed: _startQr,
            icon: const Icon(Icons.qr_code_2_rounded),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'transfer') _transferOrMerge(merge: false);
              if (v == 'merge') _transferOrMerge(merge: true);
              if (v == 'end') _endSession();
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'transfer', child: Text(l10n.transferTable)),
              PopupMenuItem(value: 'merge', child: Text(l10n.mergeTables)),
              if (_session != null)
                PopupMenuItem(value: 'end', child: Text(l10n.endSession)),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(WaiterSpacing.page),
        children: [
          WaiterSoftCard(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in [
                  'OCCUPIED',
                  'BILLING',
                  'CLEANING',
                  'AVAILABLE',
                ])
                  ChoiceChip(
                    label: Text(s),
                    selected: status.toUpperCase() == s,
                    onSelected: (_) => _setStatus(s),
                  ),
                if (status.toUpperCase() == 'AVAILABLE')
                  FilledButton(
                    onPressed: () => _setStatus('OCCUPIED'),
                    child: Text(l10n.assignTable),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _startQr,
                  icon: const Icon(Icons.qr_code_2_rounded),
                  label: Text(l10n.showQr),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _transferOrMerge(merge: false),
                  icon: const Icon(Icons.swap_horiz),
                  label: Text(l10n.transferTable),
                ),
              ),
            ],
          ),
          if (unpaid) ...[
            const SizedBox(height: 12),
            WaiterSoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l10n.unpaidBanner,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: WaiterColors.coralDeep,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('${l10n.amountDue}: ${formatInrRupees(remaining)}'),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    onPressed: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      final ok = await showCollectPaymentSheet(
                        context,
                        ref,
                        orderId: _order!['id'].toString(),
                        remaining: remaining,
                      );
                      if (!mounted) return;
                      if (ok) {
                        messenger.showSnackBar(
                          SnackBar(content: Text(l10n.paymentSuccess)),
                        );
                        await _reload();
                        ref.invalidate(tablesProvider);
                      }
                    },
                    icon: const Icon(Icons.payments_outlined),
                    label: Text(l10n.collectPayment),
                  ),
                ],
              ),
            ),
          ],
          if (_session != null) ...[
            const SizedBox(height: 12),
            WaiterSoftCard(
              child: Text(
                '${l10n.sessionActive} · ${_session!['sessionToken']?.toString().substring(0, 8) ?? ''}…',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
          const SizedBox(height: 16),
          WaiterSectionHeader(title: l10n.orders),
          const SizedBox(height: 8),
          if (_order == null)
            Text(l10n.noActiveOrder)
          else
            WaiterSoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${_order!['orderNumber']} · $orderStatus',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text(formatInr(_order!['subtotal'] as num?)),
                  if (!unpaid && _balance != null)
                    Text(
                      l10n.paidInFull,
                      style: const TextStyle(
                        color: WaiterColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ...((_order!['items'] as List?) ?? []).asMap().entries.map((entry) {
                    final it = Map<String, dynamic>.from(entry.value as Map);
                    final qty = (it['quantity'] as num?)?.toInt() ?? 1;
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text('$qty× ${it['name']}'),
                      subtitle: it['notes'] != null
                          ? Text(it['notes'].toString())
                          : null,
                      trailing: orderStatus == 'DRAFT'
                          ? Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline),
                                  onPressed: qty <= 1
                                      ? null
                                      : () async {
                                          await ref
                                              .read(waiterApiProvider)
                                              .updateItemQty(
                                                _order!['id'].toString(),
                                                it['id'].toString(),
                                                qty - 1,
                                              );
                                          await _reload();
                                        },
                                ),
                                Text('$qty'),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline),
                                  onPressed: () async {
                                    await ref
                                        .read(waiterApiProvider)
                                        .updateItemQty(
                                          _order!['id'].toString(),
                                          it['id'].toString(),
                                          qty + 1,
                                        );
                                    await _reload();
                                  },
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: () async {
                                    await ref.read(waiterApiProvider).removeItem(
                                          _order!['id'].toString(),
                                          it['id'].toString(),
                                        );
                                    await _reload();
                                  },
                                ),
                              ],
                            )
                          : Text(formatInr(
                              ((it['unitPrice'] as num?) ?? 0) * qty,
                            )),
                    );
                  }),
                  if (orderStatus == 'DRAFT')
                    FilledButton(
                      onPressed: _confirm,
                      child: Text(l10n.confirmOrder),
                    ),
                  if (orderStatus == 'READY') ...[
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: _markServed,
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Mark served'),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 16),
          WaiterSectionHeader(title: l10n.addItems),
          const SizedBox(height: 8),
          TextField(
            controller: _search,
            decoration: InputDecoration(
              labelText: l10n.searchMenu,
              prefixIcon: const Icon(Icons.search),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ChoiceChip(
                  label: Text(l10n.allCategories),
                  selected: _categoryId == null,
                  onSelected: (_) => setState(() => _categoryId = null),
                ),
                const SizedBox(width: 6),
                ..._categories.map((c) {
                  final id = c['id']?.toString();
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(c['name']?.toString() ?? ''),
                      selected: _categoryId == id,
                      onSelected: (_) => setState(() => _categoryId = id),
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 8),
          ..._items.map((item) {
            final hasOpts = (item['variants'] as List? ?? []).isNotEmpty ||
                (item['modifierGroups'] as List? ?? []).isNotEmpty;
            return ListTile(
              title: Text(item['name']?.toString() ?? ''),
              subtitle: Text(formatInr(item['price'] as num?)),
              trailing: IconButton(
                icon: const Icon(Icons.add_circle),
                color: WaiterColors.primary,
                onPressed: () {
                  if (hasOpts) {
                    _customizeAndAdd(item);
                  } else {
                    setState(() {
                      _staged.add(_StageLine(
                        menuItemId: item['id'].toString(),
                        name: item['name']?.toString() ?? 'Item',
                        unitPrice: (item['price'] as num?)?.toDouble() ?? 0,
                      ));
                    });
                  }
                },
              ),
            );
          }),
          if (_staged.isNotEmpty) ...[
            const SizedBox(height: 12),
            WaiterSoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l10n.cart,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  ..._staged.asMap().entries.map((entry) {
                    final i = entry.key;
                    final l = entry.value;
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(l.name),
                      subtitle: Text(formatInr(l.unitPrice)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () => setState(() {
                              if (l.quantity > 1) {
                                l.quantity--;
                              } else {
                                _staged.removeAt(i);
                              }
                            }),
                          ),
                          Text('${l.quantity}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => setState(() => l.quantity++),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () =>
                                setState(() => _staged.removeAt(i)),
                          ),
                        ],
                      ),
                    );
                  }),
                  TextField(
                    controller: _orderNotes,
                    decoration: InputDecoration(labelText: l10n.orderNotes),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _sendStaged,
                    child: Text(
                        '${l10n.placeItems} · ${formatInr(stagedTotal)}'),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}

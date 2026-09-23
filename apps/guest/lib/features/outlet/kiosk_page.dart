import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

/// Tablet self-order kiosk (no login). Pay at counter.
class KioskPage extends ConsumerStatefulWidget {
  const KioskPage({
    super.key,
    required this.orgSlug,
    required this.outletSlug,
  });

  final String orgSlug;
  final String outletSlug;

  @override
  ConsumerState<KioskPage> createState() => _KioskPageState();
}

class _KioskLine {
  _KioskLine({
    required this.menuItemId,
    required this.name,
    required this.unitPrice,
    this.quantity = 1,
    this.variantId,
  });

  final String menuItemId;
  final String name;
  final double unitPrice;
  int quantity;
  String? variantId;
}

class _KioskPageState extends ConsumerState<KioskPage> {
  Map<String, dynamic>? _storefront;
  String? _categoryId;
  final List<_KioskLine> _lines = [];
  final _guestName = TextEditingController();
  String _orderType = 'takeaway';
  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _placed;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _guestName.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await ref
          .read(guestApiProvider)
          .storefront(widget.orgSlug, widget.outletSlug);
      if (mounted) setState(() => _storefront = data);
    } catch (e) {
      if (mounted) {
        setState(() =>
            _error = friendlyApiError(e, fallback: 'Menu failed to load'));
      }
    }
  }

  List<dynamic> get _categories {
    final menu = _storefront?['menu'] as Map?;
    return List<dynamic>.from(menu?['categories'] as List? ?? const []);
  }

  List<dynamic> get _items {
    final menu = _storefront?['menu'] as Map?;
    final items = List<dynamic>.from(menu?['items'] as List? ?? const []);
    return items.where((raw) {
      final m = Map<String, dynamic>.from(raw as Map);
      if (m['isAvailable'] == false) return false;
      if (_categoryId == null) return true;
      return m['categoryId']?.toString() == _categoryId;
    }).toList();
  }

  double get _total =>
      _lines.fold(0.0, (s, l) => s + l.unitPrice * l.quantity);

  int get _qty => _lines.fold(0, (s, l) => s + l.quantity);

  void _addItem(Map<String, dynamic> item) {
    final id = item['id']?.toString() ?? '';
    final name = item['name']?.toString() ?? 'Item';
    final price = (item['price'] as num?)?.toDouble() ?? 0;
    setState(() {
      final idx =
          _lines.indexWhere((l) => l.menuItemId == id && l.variantId == null);
      if (idx >= 0) {
        _lines[idx].quantity += 1;
      } else {
        _lines.add(_KioskLine(menuItemId: id, name: name, unitPrice: price));
      }
    });
  }

  Future<void> _place() async {
    if (_lines.isEmpty) {
      setState(() => _error = 'Add items first');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final order = await ref.read(guestApiProvider).createOrder({
        'orgSlug': widget.orgSlug,
        'outletSlug': widget.outletSlug,
        'source': 'QR',
        'type': _orderType == 'dine_in' ? 'dine_in' : 'takeaway',
        'customerName': _guestName.text.trim().isEmpty
            ? 'Kiosk guest'
            : _guestName.text.trim(),
        'notes':
            'Kiosk · ${_orderType == 'dine_in' ? 'Eat in' : 'Pickup'} · Pay at counter',
        'items': _lines
            .map((l) => {
                  'menuItemId': l.menuItemId,
                  'quantity': l.quantity,
                  if (l.variantId != null) 'variantId': l.variantId,
                })
            .toList(),
      });
      if (!mounted) return;
      setState(() {
        _placed = order;
        _lines.clear();
      });
    } catch (e) {
      if (mounted) {
        setState(() =>
            _error = friendlyApiError(e, fallback: 'Could not place order'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startOver() {
    setState(() {
      _placed = null;
      _lines.clear();
      _guestName.clear();
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_placed != null) {
      final code = (_placed!['pickupCode'] ??
              _placed!['orderNumber'] ??
              _placed!['id'])
          .toString();
      return Scaffold(
        body: Center(
          child: GuestSoftCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Order placed',
                    style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 8),
                const Text('Show this code at the counter to pay'),
                const SizedBox(height: 16),
                Text(
                  code,
                  style: TextStyle(
                    fontSize: 56,
                    fontWeight: FontWeight.w900,
                    color: GuestColors.primaryOf(context),
                    letterSpacing: 4,
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _startOver,
                  child: const Text('New order'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final orgName = _storefront?['organizationName']?.toString() ??
        _storefront?['brandName']?.toString() ??
        'Cullinos';

    return Scaffold(
      appBar: AppBar(
        title: Text('$orgName · Kiosk'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(
                '₹${_total.toStringAsFixed(0)} · $_qty items',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
      body: _storefront == null
          ? Center(
              child: _error != null
                  ? Text(_error!)
                  : const CircularProgressIndicator(),
            )
          : Row(
              children: [
                SizedBox(
                  width: 160,
                  child: ListView(
                    children: [
                      ListTile(
                        selected: _categoryId == null,
                        title: const Text('All'),
                        onTap: () => setState(() => _categoryId = null),
                      ),
                      ..._categories.map((raw) {
                        final c = Map<String, dynamic>.from(raw as Map);
                        final id = c['id']?.toString();
                        return ListTile(
                          selected: _categoryId == id,
                          title: Text(c['name']?.toString() ?? ''),
                          onTap: () => setState(() => _categoryId = id),
                        );
                      }),
                    ],
                  ),
                ),
                const VerticalDivider(width: 1),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      childAspectRatio: 1.1,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: _items.length,
                    itemBuilder: (_, i) {
                      final item =
                          Map<String, dynamic>.from(_items[i] as Map);
                      final price =
                          (item['price'] as num?)?.toStringAsFixed(0) ?? '0';
                      return InkWell(
                        onTap: () => _addItem(item),
                        borderRadius:
                            BorderRadius.circular(GuestSpacing.radiusMd),
                        child: GuestSoftCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  item['name']?.toString() ?? '',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                '₹$price',
                                style: TextStyle(
                                  color: GuestColors.primaryOf(context),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 18,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                SizedBox(
                  width: 300,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('Cart',
                            style: TextStyle(
                                fontSize: 20, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _guestName,
                          decoration: const InputDecoration(
                            labelText: 'Guest name (optional)',
                          ),
                        ),
                        const SizedBox(height: 8),
                        SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(
                                value: 'takeaway', label: Text('Pickup')),
                            ButtonSegment(
                                value: 'dine_in', label: Text('Eat in')),
                          ],
                          selected: {_orderType},
                          onSelectionChanged: (s) =>
                              setState(() => _orderType = s.first),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: ListView(
                            children: _lines.map((l) {
                              final lineTotal =
                                  (l.unitPrice * l.quantity).toStringAsFixed(0);
                              return ListTile(
                                dense: true,
                                title: Text(l.name),
                                subtitle: Text('₹$lineTotal'),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.remove),
                                      onPressed: () => setState(() {
                                        l.quantity -= 1;
                                        if (l.quantity <= 0) {
                                          _lines.remove(l);
                                        }
                                      }),
                                    ),
                                    Text('${l.quantity}'),
                                    IconButton(
                                      icon: const Icon(Icons.add),
                                      onPressed: () =>
                                          setState(() => l.quantity += 1),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        if (_error != null)
                          Text(_error!,
                              style: const TextStyle(color: Colors.red)),
                        FilledButton(
                          onPressed: _loading ? null : _place,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(52),
                            backgroundColor: GuestColors.primaryOf(context),
                          ),
                          child: Text(
                            _loading
                                ? 'Placing…'
                                : 'Place order · Pay at counter · ₹${_total.toStringAsFixed(0)}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
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
}

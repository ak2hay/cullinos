/// Shared helpers to normalize storefront menu payloads for Guest UI.
List<Map<String, dynamic>> parseStorefrontCategories(Map<String, dynamic> data) {
  final menu = data['menu'];
  if (menu is! Map) return [];
  final categories = List<dynamic>.from(menu['categories'] as List? ?? []);
  final items = List<dynamic>.from(menu['items'] as List? ?? []);
  return categories.map((raw) {
    final c = Map<String, dynamic>.from(raw as Map);
    final catItems = items
        .map((i) => Map<String, dynamic>.from(i as Map))
        .where((i) => i['categoryId'] == c['id'])
        .map(normalizeMenuItem)
        .toList();
    return {...c, 'items': catItems};
  }).toList();
}

Map<String, dynamic> normalizeMenuItem(Map<String, dynamic> i) {
  final pricePaise = (i['price'] as num?) ?? 0;
  return {
    ...i,
    'price': pricePaise / 100,
    'variants': (i['variants'] as List? ?? []).map((v) {
      final vv = Map<String, dynamic>.from(v as Map);
      return {
        ...vv,
        'price': ((vv['price'] as num?) ?? 0) / 100,
      };
    }).toList(),
    'modifierGroups': (i['modifierGroups'] as List? ?? []).map((g) {
      final gg = Map<String, dynamic>.from(g as Map);
      return {
        ...gg,
        'modifiers': (gg['modifiers'] as List? ?? []).map((m) {
          final mm = Map<String, dynamic>.from(m as Map);
          return {
            ...mm,
            'price': ((mm['price'] as num?) ?? 0) / 100,
          };
        }).toList(),
      };
    }).toList(),
  };
}

Map<String, dynamic>? findMenuItem(
  List<Map<String, dynamic>> categories,
  String itemId,
) {
  for (final cat in categories) {
    final items = List<dynamic>.from((cat['items'] ?? []) as List);
    for (final raw in items) {
      final item = Map<String, dynamic>.from(raw as Map);
      if (item['id']?.toString() == itemId) return item;
    }
  }
  return null;
}

String formatInr(num value) => '₹${value.toStringAsFixed(0)}';

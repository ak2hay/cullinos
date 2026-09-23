import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CartLine {
  CartLine({
    required this.menuItemId,
    required this.name,
    required this.unitPrice,
    this.quantity = 1,
    this.notes,
    this.variantId,
    this.variantLabel,
    this.modifiers,
    this.lineKey,
    this.imageUrl,
    this.isVeg,
  });

  final String menuItemId;
  final String name;
  final double unitPrice;
  int quantity;
  String? notes;
  String? variantId;
  String? variantLabel;
  List<Map<String, dynamic>>? modifiers;
  String? lineKey;
  String? imageUrl;
  bool? isVeg;

  double get lineTotal => unitPrice * quantity;

  String get key =>
      lineKey ??
      '$menuItemId|${variantId ?? ''}|${(modifiers ?? []).map((m) => m['id']).join(',')}';
}

class CartState extends ChangeNotifier {
  final List<CartLine> lines = [];
  String? orgId;
  String? outletId;
  String? orgSlug;
  String? outletSlug;
  String? customerId;
  String? sessionToken;
  String? tableName;
  String orderType = 'takeaway';
  String? restaurantName;
  String? restaurantImageUrl;
  String? restaurantLocation;
  String? specialInstructions;

  double get subtotal => lines.fold(0, (s, l) => s + l.lineTotal);

  int get itemCount => lines.fold(0, (s, l) => s + l.quantity);

  void bindOutlet({
    required String orgId,
    required String outletId,
    required String orgSlug,
    required String outletSlug,
    String? customerId,
    String? sessionToken,
    String? tableName,
    String? restaurantName,
    String? restaurantImageUrl,
    String? restaurantLocation,
  }) {
    if (this.outletId != null && this.outletId != outletId) {
      lines.clear();
      specialInstructions = null;
    }
    this.orgId = orgId;
    this.outletId = outletId;
    this.orgSlug = orgSlug;
    this.outletSlug = outletSlug;
    this.customerId = customerId;
    this.sessionToken = sessionToken;
    if (tableName != null) this.tableName = tableName;
    if (restaurantName != null) this.restaurantName = restaurantName;
    if (restaurantImageUrl != null) {
      this.restaurantImageUrl = restaurantImageUrl;
    }
    if (restaurantLocation != null) {
      this.restaurantLocation = restaurantLocation;
    }
    notifyListeners();
  }

  void setSession({String? sessionToken, String? tableName}) {
    this.sessionToken = sessionToken;
    if (tableName != null) this.tableName = tableName;
    if (sessionToken != null && sessionToken.isNotEmpty) {
      orderType = 'dine_in';
    }
    notifyListeners();
  }

  void addItem({
    required String menuItemId,
    required String name,
    required double unitPrice,
    String? variantId,
    String? variantLabel,
    List<Map<String, dynamic>>? modifiers,
    String? notes,
    int quantity = 1,
    String? imageUrl,
    bool? isVeg,
  }) {
    final key =
        '$menuItemId|${variantId ?? ''}|${(modifiers ?? []).map((m) => m['id']).join(',')}';
    final existingIndex = lines.indexWhere((l) => l.key == key);
    if (existingIndex >= 0) {
      lines[existingIndex].quantity += quantity;
    } else {
      lines.add(CartLine(
        menuItemId: menuItemId,
        name: name,
        unitPrice: unitPrice,
        quantity: quantity,
        notes: notes,
        variantId: variantId,
        variantLabel: variantLabel,
        modifiers: modifiers,
        lineKey: key,
        imageUrl: imageUrl,
        isVeg: isVeg,
      ));
    }
    notifyListeners();
  }

  void setQtyByKey(String key, int qty) {
    lines.removeWhere((l) {
      if (l.key != key) return false;
      if (qty <= 0) return true;
      l.quantity = qty;
      return false;
    });
    notifyListeners();
  }

  void setQty(String menuItemId, int qty) {
    lines.removeWhere((l) {
      if (l.menuItemId != menuItemId) return false;
      if (qty <= 0) return true;
      l.quantity = qty;
      return false;
    });
    notifyListeners();
  }

  void removeByKey(String key) {
    lines.removeWhere((l) => l.key == key);
    notifyListeners();
  }

  void setLineNotes(String key, String? notes) {
    for (final line in lines) {
      if (line.key == key) {
        final trimmed = notes?.trim();
        line.notes = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
        break;
      }
    }
    notifyListeners();
  }

  void setSpecialInstructions(String? value) {
    specialInstructions = value?.trim().isEmpty == true ? null : value?.trim();
    notifyListeners();
  }

  void replaceFromReorder(List<CartLine> next) {
    lines
      ..clear()
      ..addAll(next);
    notifyListeners();
  }

  void clear() {
    lines.clear();
    specialInstructions = null;
    notifyListeners();
  }

  void setOrderType(String type) {
    orderType = type;
    notifyListeners();
  }
}

final cartProvider = ChangeNotifierProvider<CartState>((ref) => CartState());

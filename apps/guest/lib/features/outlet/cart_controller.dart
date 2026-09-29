import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Matches the API limit on `CreateOrderItemDto.notes`.
const int cartNoteMaxLength = 200;

String? normalizeCartNote(String? notes) {
  final trimmed = notes?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed.length > cartNoteMaxLength
      ? trimmed.substring(0, cartNoteMaxLength)
      : trimmed;
}

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
    this.isAlcohol = false,
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
  final bool isAlcohol;

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

  /// Guest confirmed legal drinking age for this outlet session.
  bool ageConfirmed = false;

  double get subtotal => lines.fold(0, (s, l) => s + l.lineTotal);

  int get itemCount => lines.fold(0, (s, l) => s + l.quantity);

  /// Drinks in the cart restrict the order to dine-in.
  bool get hasAlcohol => lines.any((l) => l.isAlcohol);

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
      ageConfirmed = false;
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
    bool isAlcohol = false,
  }) {
    final cleanNotes = normalizeCartNote(notes);
    // Notes are part of the key so each note stays on its own kitchen line.
    final key =
        '$menuItemId|${variantId ?? ''}|${(modifiers ?? []).map((m) => m['id']).join(',')}|${cleanNotes ?? ''}';
    final existingIndex = lines.indexWhere((l) => l.key == key);
    if (existingIndex >= 0) {
      lines[existingIndex].quantity += quantity;
    } else {
      lines.add(CartLine(
        menuItemId: menuItemId,
        name: name,
        unitPrice: unitPrice,
        quantity: quantity,
        notes: cleanNotes,
        variantId: variantId,
        variantLabel: variantLabel,
        modifiers: modifiers,
        lineKey: key,
        imageUrl: imageUrl,
        isVeg: isVeg,
        isAlcohol: isAlcohol,
      ));
    }
    if (isAlcohol) orderType = 'dine_in';
    notifyListeners();
  }

  void confirmAge() {
    ageConfirmed = true;
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
        line.notes = normalizeCartNote(notes);
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
    if (hasAlcohol) orderType = 'dine_in';
    notifyListeners();
  }

  void clear() {
    lines.clear();
    specialInstructions = null;
    notifyListeners();
  }

  void setOrderType(String type) {
    orderType = hasAlcohol ? 'dine_in' : type;
    notifyListeners();
  }
}

final cartProvider = ChangeNotifierProvider<CartState>((ref) => CartState());

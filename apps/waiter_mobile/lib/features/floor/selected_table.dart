import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Selected table for tablet master–detail and center QR action.
class SelectedTableController extends ChangeNotifier {
  String? tableId;

  void select(String? id) {
    if (tableId == id) return;
    tableId = id;
    notifyListeners();
  }

  void clear() => select(null);
}

final selectedTableProvider =
    ChangeNotifierProvider<SelectedTableController>((ref) {
  return SelectedTableController();
});

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum TableAction { merge, transfer }

bool isMergedTable(Map<String, dynamic> t) =>
    (t['mergedIntoTableId']?.toString() ?? '').isNotEmpty;

/// Two-step "tap a table, then tap another" flow for merge and transfer on the floor grid.
class TableActionController extends ChangeNotifier {
  TableAction? mode;
  String? firstId;
  String? firstName;

  /// Bumped after a merge/transfer so open table details reload.
  int revision = 0;

  bool get active => mode != null;

  void start(TableAction action, {String? tableId, String? tableName}) {
    mode = action;
    firstId = tableId;
    firstName = tableName;
    notifyListeners();
  }

  void pickFirst(String id, String name) {
    firstId = id;
    firstName = name;
    notifyListeners();
  }

  void cancel() {
    mode = null;
    firstId = null;
    firstName = null;
    notifyListeners();
  }

  void completed() {
    revision++;
    cancel();
  }

  bool isEligible(Map<String, dynamic> t) {
    final action = mode;
    if (action == null) return true;
    final id = t['id']?.toString();
    final status = (t['status']?.toString() ?? '').toUpperCase();
    final merged = isMergedTable(t);
    if (firstId == null) {
      if (action == TableAction.merge) return !merged;
      return !merged && (status == 'OCCUPIED' || status == 'BILLING');
    }
    if (id == firstId || merged) return false;
    if (action == TableAction.merge) {
      return status == 'AVAILABLE' || status == 'OCCUPIED';
    }
    return status == 'AVAILABLE';
  }
}

final tableActionProvider = ChangeNotifierProvider<TableActionController>((ref) {
  return TableActionController();
});

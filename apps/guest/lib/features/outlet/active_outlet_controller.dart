import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ActiveOutletState {
  const ActiveOutletState({
    this.orgSlug,
    this.outletSlug,
    this.orgId,
    this.outletId,
    this.name,
    this.themeKey,
    this.primaryColor,
    this.accentColor,
  });

  final String? orgSlug;
  final String? outletSlug;
  final String? orgId;
  final String? outletId;
  final String? name;
  final String? themeKey;
  final String? primaryColor;
  final String? accentColor;

  bool get isActive =>
      orgSlug != null &&
      orgSlug!.isNotEmpty &&
      outletSlug != null &&
      outletSlug!.isNotEmpty;

  String get outletPath => '/o/$orgSlug/$outletSlug';

  ActiveOutletState copyWith({
    String? orgSlug,
    String? outletSlug,
    String? orgId,
    String? outletId,
    String? name,
    String? themeKey,
    String? primaryColor,
    String? accentColor,
    bool clear = false,
  }) {
    if (clear) return const ActiveOutletState();
    return ActiveOutletState(
      orgSlug: orgSlug ?? this.orgSlug,
      outletSlug: outletSlug ?? this.outletSlug,
      orgId: orgId ?? this.orgId,
      outletId: outletId ?? this.outletId,
      name: name ?? this.name,
      themeKey: themeKey ?? this.themeKey,
      primaryColor: primaryColor ?? this.primaryColor,
      accentColor: accentColor ?? this.accentColor,
    );
  }
}

class ActiveOutletController extends ChangeNotifier {
  ActiveOutletState _state = const ActiveOutletState();

  ActiveOutletState get state => _state;

  void setOutlet({
    required String orgSlug,
    required String outletSlug,
    String? orgId,
    String? outletId,
    String? name,
    String? themeKey,
    String? primaryColor,
    String? accentColor,
  }) {
    _state = ActiveOutletState(
      orgSlug: orgSlug,
      outletSlug: outletSlug,
      orgId: orgId,
      outletId: outletId,
      name: name,
      themeKey: themeKey,
      primaryColor: primaryColor,
      accentColor: accentColor,
    );
    notifyListeners();
  }

  void clear() {
    _state = const ActiveOutletState();
    notifyListeners();
  }
}

final activeOutletProvider =
    ChangeNotifierProvider<ActiveOutletController>((ref) {
  return ActiveOutletController();
});

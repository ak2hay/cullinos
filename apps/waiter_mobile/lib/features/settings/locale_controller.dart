import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kLocale = 'waiter_locale';

class LocaleController extends ChangeNotifier {
  Locale _locale = const Locale('en');
  Locale get locale => _locale;

  static const supported = <Locale>[
    Locale('en'),
    Locale('hi'),
    Locale('mr'),
    Locale('gu'),
    Locale('ta'),
    Locale('bn'),
    Locale('te'),
    Locale('kn'),
    Locale('ml'),
    Locale('pa'),
  ];

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_kLocale) ?? 'en';
    _locale = Locale(code);
    notifyListeners();
  }

  Future<void> setLocale(Locale locale) async {
    _locale = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLocale, locale.languageCode);
    notifyListeners();
  }
}

final localeControllerProvider =
    ChangeNotifierProvider<LocaleController>((ref) => LocaleController());

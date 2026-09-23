import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/app.dart';
import 'package:cullinos_waiter/core/config.dart';

Future<void> bootstrapWaiterApp(AppConfig config) async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.current = config;
  runApp(const ProviderScope(child: CullinosWaiterApp()));
}

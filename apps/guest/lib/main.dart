import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/app.dart';
import 'package:cullinos_guest/core/config.dart';
import 'package:cullinos_guest/core/firebase/firebase_options.dart';

Future<void> bootstrapGuestApp(AppConfig config) async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.current = config;
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const ProviderScope(child: CullinosGuestApp()));
}

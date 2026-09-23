import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/config.dart';
import 'package:cullinos_guest/core/deep_links.dart';
import 'package:cullinos_guest/core/router.dart';
import 'package:cullinos_guest/core/theme.dart';

class CullinosGuestApp extends ConsumerStatefulWidget {
  const CullinosGuestApp({super.key});

  @override
  ConsumerState<CullinosGuestApp> createState() => _CullinosGuestAppState();
}

class _CullinosGuestAppState extends ConsumerState<CullinosGuestApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final router = ref.read(routerProvider);
      GuestDeepLinkListener.instance.start(router);
    });
  }

  @override
  void dispose() {
    GuestDeepLinkListener.instance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: AppConfig.current.appName,
      theme: buildGuestTheme(),
      routerConfig: router,
      debugShowCheckedModeBanner: AppConfig.current.flavor != 'prod',
    );
  }
}

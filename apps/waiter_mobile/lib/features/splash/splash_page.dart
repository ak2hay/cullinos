import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/connectivity_controller.dart';
import 'package:cullinos_waiter/core/force_update.dart';
import 'package:cullinos_waiter/core/portal_status.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/features/settings/locale_controller.dart';
import 'package:cullinos_waiter/features/settings/prefs_controller.dart';
import 'package:cullinos_waiter/core/waiter_socket.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await ref.read(localeControllerProvider).hydrate();
    await ref.read(prefsControllerProvider).hydrate();
    await ref.read(connectivityControllerProvider).hydrate();
    await ref.read(portalStatusProvider).check(ref.read(dioProvider));
    await ref.read(authControllerProvider).hydrate();
    final auth = ref.read(authControllerProvider);
    if (auth.isAuthenticated) {
      ref.read(waiterSocketProvider).connect(auth.accessToken);
      ref.read(waiterSocketProvider).joinOutlet(auth.selectedOutletId);
    }
    if (mounted) {
      await checkForceUpdate(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Cullinos Waiter',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                color: WaiterColors.primary,
              ),
            ),
            SizedBox(height: 16),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}

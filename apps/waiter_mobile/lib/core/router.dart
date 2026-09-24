import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_waiter/core/connectivity_controller.dart';
import 'package:cullinos_waiter/core/portal_status.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/features/auth/login_page.dart';
import 'package:cullinos_waiter/features/calls/calls_page.dart';
import 'package:cullinos_waiter/features/floor/floor_page.dart';
import 'package:cullinos_waiter/features/order/table_detail_page.dart';
import 'package:cullinos_waiter/features/orders/orders_hub_page.dart';
import 'package:cullinos_waiter/features/portal/portal_disabled_page.dart';
import 'package:cullinos_waiter/features/settings/settings_page.dart';
import 'package:cullinos_waiter/features/splash/splash_page.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/waiter_floating_nav.dart';

final waiterRootKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.read(authControllerProvider);
  final portal = ref.read(portalStatusProvider);
  return GoRouter(
    navigatorKey: waiterRootKey,
    initialLocation: '/splash',
    refreshListenable: Listenable.merge([auth, portal]),
    redirect: (context, state) {
      final a = ref.read(authControllerProvider);
      final loc = state.matchedLocation;
      if (!a.hydrated) return loc == '/splash' ? null : '/splash';
      if (ref.read(portalStatusProvider).disabled) {
        return loc == '/portal-disabled' ? null : '/portal-disabled';
      }
      if (loc == '/portal-disabled') return a.isAuthenticated ? '/' : '/login';
      final loggingIn = loc == '/login';
      if (!a.isAuthenticated) {
        if (loggingIn || loc == '/splash') return loggingIn ? null : '/login';
        return '/login';
      }
      if (loggingIn || loc == '/splash') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(
        path: '/portal-disabled',
        builder: (_, __) => const PortalDisabledPage(),
      ),
      GoRoute(
        path: '/table/:tableId',
        builder: (_, state) => TableDetailPage(
          tableId: state.pathParameters['tableId']!,
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return _WaiterShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/', builder: (_, __) => const FloorPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/calls', builder: (_, __) => const CallsPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/orders', builder: (_, __) => const OrdersHubPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/more', builder: (_, __) => const SettingsPage()),
          ]),
        ],
      ),
    ],
  );
});

class _WaiterShell extends ConsumerWidget {
  const _WaiterShell({required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final online = ref.watch(connectivityControllerProvider).online;
    final wide = MediaQuery.sizeOf(context).width >= 900;

    Widget content = Column(
      children: [
        if (!online)
          Material(
            color: WaiterColors.coralDeep,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.wifi_off, color: Colors.white, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        l10n.offline,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1200),
              child: navigationShell,
            ),
          ),
        ),
      ],
    );

    if (wide) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: navigationShell.currentIndex,
              onDestinationSelected: navigationShell.goBranch,
              labelType: NavigationRailLabelType.all,
              destinations: [
                NavigationRailDestination(
                  icon: const Icon(Icons.grid_view_outlined),
                  selectedIcon: const Icon(Icons.grid_view_rounded),
                  label: Text(l10n.floor),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.notifications_outlined),
                  selectedIcon: const Icon(Icons.notifications_active),
                  label: Text(l10n.calls),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.receipt_long_outlined),
                  selectedIcon: const Icon(Icons.receipt_long),
                  label: Text(l10n.orders),
                ),
                NavigationRailDestination(
                  icon: const Icon(Icons.more_horiz),
                  selectedIcon: const Icon(Icons.more_horiz),
                  label: Text(l10n.more),
                ),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: content),
          ],
        ),
      );
    }

    return Scaffold(
      body: content,
      bottomNavigationBar: WaiterFloatingNav(
        currentIndex: navigationShell.currentIndex,
        onTap: navigationShell.goBranch,
      ),
    );
  }
}

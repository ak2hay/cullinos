import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_remote_config.dart';
import 'package:cullinos_guest/core/theme.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/auth/login_page.dart';
import 'package:cullinos_guest/features/discover/discover_page.dart';
import 'package:cullinos_guest/features/explore/explore_page.dart';
import 'package:cullinos_guest/features/loyalty/coins_page.dart';
import 'package:cullinos_guest/features/loyalty/wallets_page.dart';
import 'package:cullinos_guest/features/offers/offers_page.dart';
import 'package:cullinos_guest/features/orders/orders_page.dart';
import 'package:cullinos_guest/features/orders/order_detail_page.dart';
import 'package:cullinos_guest/features/outlet/active_outlet_controller.dart';
import 'package:cullinos_guest/features/outlet/outlet_shell_page.dart';
import 'package:cullinos_guest/features/outlet/menu_page.dart';
import 'package:cullinos_guest/features/outlet/book_page.dart';
import 'package:cullinos_guest/features/outlet/cart_page.dart';
import 'package:cullinos_guest/features/outlet/product_detail_page.dart';
import 'package:cullinos_guest/features/outlet/checkout_page.dart';
import 'package:cullinos_guest/features/outlet/kiosk_page.dart';
import 'package:cullinos_guest/features/outlet/scan_page.dart';
import 'package:cullinos_guest/features/location/map_pin_page.dart';
import 'package:cullinos_guest/features/profile/profile_page.dart';
import 'package:cullinos_guest/features/profile/notifications_page.dart';
import 'package:cullinos_guest/features/profile/legal_web_page.dart';
import 'package:cullinos_guest/features/splash/splash_page.dart';
import 'package:cullinos_guest/widgets/guest_floating_nav.dart';
import 'package:cullinos_guest/widgets/restaurant_bottom_nav.dart';

final guestRootNavigatorKey = GlobalKey<NavigatorState>();

bool _isPublicPath(String loc) {
  if (loc == '/' ||
      loc == '/explore' ||
      loc == '/offers' ||
      loc == '/scan' ||
      loc == '/location/map' ||
      loc == '/login' ||
      loc == '/splash' ||
      loc == '/privacy' ||
      loc == '/terms' ||
      loc == '/book' ||
      loc.startsWith('/book?')) {
    return true;
  }
  if (loc.startsWith('/o/')) {
    // Kiosk is public (no login). Checkout requires auth.
    if (loc.contains('/kiosk')) return true;
    if (loc.contains('/book')) return true;
    if (loc.endsWith('/checkout') || loc.contains('/checkout')) {
      return false;
    }
    return true;
  }
  return false;
}

bool _isAuthRequiredPath(String loc) {
  if (loc.startsWith('/orders') ||
      loc.startsWith('/wallets') ||
      loc.startsWith('/coins') ||
      loc.startsWith('/profile') ||
      loc.startsWith('/notifications')) {
    return true;
  }
  if (loc.contains('/checkout')) return true;
  return false;
}

/// Map shell branch index → bottom-nav slot (Scan is slot 2, not a branch).
int _navIndexFromShell(int shellIndex) {
  switch (shellIndex) {
    case 0:
      return 0; // Home
    case 1:
      return 1; // Explore
    case 2:
      return 3; // Offers
    case 3:
      return 4; // Profile
    default:
      return 0;
  }
}

int _shellIndexFromNav(int navIndex) {
  switch (navIndex) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 3:
      return 2;
    case 4:
      return 3;
    default:
      return -1; // Scan
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  // Use read so auth notifyListeners() does not recreate GoRouter (which
  // resets to /splash → /). refreshListenable still re-runs redirect.
  final auth = ref.read(authControllerProvider);

  return GoRouter(
    navigatorKey: guestRootNavigatorKey,
    initialLocation: '/splash',
    refreshListenable: auth,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;
      final loggingIn = loc == '/login';
      final splashing = loc == '/splash';

      if (!auth.hydrated) {
        return splashing ? null : '/splash';
      }

      if (!auth.isAuthenticated) {
        if (splashing) return '/';
        if (loggingIn || _isPublicPath(loc)) return null;
        if (_isAuthRequiredPath(loc)) {
          final next = Uri.encodeComponent(state.uri.toString());
          return '/login?next=$next';
        }
        return null;
      }

      if (loggingIn || splashing) {
        final next = state.uri.queryParameters['next'];
        if (next != null && next.isNotEmpty) {
          return Uri.decodeComponent(next);
        }
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(
        path: '/login',
        builder: (_, state) => LoginPage(
          nextPath: state.uri.queryParameters['next'],
        ),
      ),
      GoRoute(
        path: '/privacy',
        builder: (context, __) {
          final remote = ProviderScope.containerOf(context)
              .read(guestRemoteConfigProvider);
          return LegalWebPage(
            title: 'Privacy Policy',
            url: (remote.privacyUrl?.trim().isNotEmpty == true)
                ? remote.privacyUrl!
                : 'https://cullinos.com/privacy',
          );
        },
      ),
      GoRoute(
        path: '/terms',
        builder: (context, __) {
          final remote = ProviderScope.containerOf(context)
              .read(guestRemoteConfigProvider);
          return LegalWebPage(
            title: 'Terms of Service',
            url: (remote.termsUrl?.trim().isNotEmpty == true)
                ? remote.termsUrl!
                : 'https://cullinos.com/terms',
          );
        },
      ),
      GoRoute(
        path: '/wallets',
        builder: (_, __) => const WalletsPage(),
      ),
      GoRoute(
        path: '/coins',
        builder: (_, __) => const CoinsPage(),
      ),
      GoRoute(
        path: '/orders',
        builder: (_, __) => const OrdersPage(),
      ),
      GoRoute(
        path: '/orders/:id',
        builder: (_, state) =>
            OrderDetailPage(orderId: state.pathParameters['id']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return _GuestShellScaffold(
            navigationShell: navigationShell,
            matchedLocation: state.matchedLocation,
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/', builder: (_, __) => const DiscoverPage()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/explore', builder: (_, __) => const ExplorePage()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/offers', builder: (_, __) => const OffersPage()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
            ],
          ),
        ],
      ),
      GoRoute(path: '/scan', builder: (_, __) => const ScanPage()),
      GoRoute(
        path: '/book',
        builder: (context, state) {
          return BookPage(
            orgSlug: state.uri.queryParameters['orgSlug'],
            outletSlug: state.uri.queryParameters['outletSlug'],
            inviteToken: state.uri.queryParameters['invite'],
          );
        },
      ),
      GoRoute(
        path: '/location/map',
        builder: (context, state) {
          final returnResult =
              state.uri.queryParameters['returnResult'] == '1';
          return MapPinPage(returnResult: returnResult);
        },
      ),
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsPage(),
      ),
      GoRoute(
        path: '/o/:orgSlug/:outletSlug',
        builder: (context, state) {
          final orgSlug = state.pathParameters['orgSlug']!;
          final outletSlug = state.pathParameters['outletSlug']!;
          return _RestaurantScaffold(
            orgSlug: orgSlug,
            outletSlug: outletSlug,
            child: OutletShellPage(
              orgSlug: orgSlug,
              outletSlug: outletSlug,
              sessionToken: state.uri.queryParameters['session'],
              tableCode: state.uri.queryParameters['table'],
            ),
          );
        },
        routes: [
          GoRoute(
            path: 'book',
            builder: (context, state) {
              final orgSlug = state.pathParameters['orgSlug']!;
              final outletSlug = state.pathParameters['outletSlug']!;
              return BookPage(orgSlug: orgSlug, outletSlug: outletSlug);
            },
          ),
          GoRoute(
            path: 'menu',
            builder: (context, state) {
              final orgSlug = state.pathParameters['orgSlug']!;
              final outletSlug = state.pathParameters['outletSlug']!;
              return _RestaurantScaffold(
                orgSlug: orgSlug,
                outletSlug: outletSlug,
                child: MenuPage(orgSlug: orgSlug, outletSlug: outletSlug),
              );
            },
          ),
          GoRoute(
            path: 'item/:itemId',
            builder: (context, state) {
              final orgSlug = state.pathParameters['orgSlug']!;
              final outletSlug = state.pathParameters['outletSlug']!;
              return _RestaurantScaffold(
                orgSlug: orgSlug,
                outletSlug: outletSlug,
                child: ProductDetailPage(
                  orgSlug: orgSlug,
                  outletSlug: outletSlug,
                  itemId: state.pathParameters['itemId']!,
                ),
              );
            },
          ),
          GoRoute(
            path: 'cart',
            builder: (context, state) {
              final orgSlug = state.pathParameters['orgSlug']!;
              final outletSlug = state.pathParameters['outletSlug']!;
              return _RestaurantScaffold(
                orgSlug: orgSlug,
                outletSlug: outletSlug,
                child: CartPage(orgSlug: orgSlug, outletSlug: outletSlug),
              );
            },
          ),
          GoRoute(
                path: 'kiosk',
                builder: (context, state) {
                  final orgSlug = state.pathParameters['orgSlug']!;
                  final outletSlug = state.pathParameters['outletSlug']!;
                  return KioskPage(orgSlug: orgSlug, outletSlug: outletSlug);
                },
              ),
              GoRoute(
            path: 'checkout',
            builder: (context, state) {
              final orgSlug = state.pathParameters['orgSlug']!;
              final outletSlug = state.pathParameters['outletSlug']!;
              return _RestaurantScaffold(
                orgSlug: orgSlug,
                outletSlug: outletSlug,
                child: CheckoutPage(orgSlug: orgSlug, outletSlug: outletSlug),
              );
            },
          ),
        ],
      ),
    ],
  );
});

class _RestaurantScaffold extends ConsumerWidget {
  const _RestaurantScaffold({
    required this.orgSlug,
    required this.outletSlug,
    required this.child,
  });

  final String orgSlug;
  final String outletSlug;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final path = GoRouterState.of(context).uri.path;
    final active = ref.watch(activeOutletProvider).state;
    final palette = GuestPalette.resolve(
      themeKey: active.themeKey,
      primaryColor: active.primaryColor,
      accentColor: active.accentColor,
    );
    final restaurantTheme = buildGuestThemeFromPalette(palette);

    return Theme(
      data: restaurantTheme,
      child: GuestPaletteScope(
        palette: palette,
        child: Scaffold(
          backgroundColor: GuestColors.scaffold,
          extendBody: true,
          body: child,
          bottomNavigationBar: RestaurantBottomNav(
            orgSlug: orgSlug,
            outletSlug: outletSlug,
            currentPath: path,
          ),
        ),
      ),
    );
  }
}

class _GuestShellScaffold extends ConsumerStatefulWidget {
  const _GuestShellScaffold({
    required this.navigationShell,
    required this.matchedLocation,
  });

  final StatefulNavigationShell navigationShell;
  final String matchedLocation;

  @override
  ConsumerState<_GuestShellScaffold> createState() => _GuestShellScaffoldState();
}

class _GuestShellScaffoldState extends ConsumerState<_GuestShellScaffold> {
  DateTime? _lastBackAt;

  bool get _onHomeOrExplore {
    final loc = widget.matchedLocation;
    return loc == '/' || loc == '/explore';
  }

  bool get _onShellRoot {
    final loc = widget.matchedLocation;
    return loc == '/' ||
        loc == '/explore' ||
        loc == '/offers' ||
        loc == '/profile';
  }

  void _handleBack() {
    final loc = widget.matchedLocation;

    if (!_onShellRoot) {
      context.go('/');
      return;
    }

    if (!_onHomeOrExplore) {
      widget.navigationShell.goBranch(0);
      return;
    }

    final now = DateTime.now();
    final last = _lastBackAt;
    if (last != null && now.difference(last) < const Duration(seconds: 2)) {
      SystemNavigator.pop();
      return;
    }
    _lastBackAt = now;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Press back again to exit'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _onNavTap(int navIndex) {
    if (navIndex == 2) {
      context.push('/scan');
      return;
    }

    final auth = ref.read(authControllerProvider);
    if (!auth.isAuthenticated && navIndex == 4) {
      context.push('/login?next=${Uri.encodeComponent('/profile')}');
      return;
    }

    final shell = _shellIndexFromNav(navIndex);
    if (shell >= 0) {
      widget.navigationShell.goBranch(shell);
    }
  }

  @override
  Widget build(BuildContext context) {
    final navIndex = _navIndexFromShell(widget.navigationShell.currentIndex);
    // If an outlet is active but user is on marketplace shell, keep marketplace nav
    // (Orders only inside restaurant scaffold).
    ref.watch(activeOutletProvider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
        backgroundColor: GuestColors.scaffold,
        extendBody: true,
        body: widget.navigationShell,
        bottomNavigationBar: GuestFloatingNav(
          currentIndex: navIndex,
          onTap: _onNavTap,
          items: const [
            GuestNavItem(
              icon: Icons.home_outlined,
              activeIcon: Icons.home_rounded,
              label: 'Home',
            ),
            GuestNavItem(
              icon: Icons.explore_outlined,
              activeIcon: Icons.explore_rounded,
              label: 'Explore',
            ),
            GuestNavItem(
              icon: Icons.qr_code_scanner_rounded,
              activeIcon: Icons.qr_code_scanner_rounded,
              label: 'Scan',
              raised: true,
            ),
            GuestNavItem(
              icon: Icons.local_offer_outlined,
              activeIcon: Icons.local_offer_rounded,
              label: 'Offers',
            ),
            GuestNavItem(
              icon: Icons.person_outline_rounded,
              activeIcon: Icons.person_rounded,
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}

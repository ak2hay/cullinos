import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/features/outlet/active_outlet_controller.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';
import 'package:cullinos_guest/widgets/guest_floating_nav.dart';

/// Bottom nav while browsing a selected / scanned restaurant.
class RestaurantBottomNav extends ConsumerWidget {
  const RestaurantBottomNav({
    super.key,
    required this.orgSlug,
    required this.outletSlug,
    required this.currentPath,
  });

  final String orgSlug;
  final String outletSlug;
  final String currentPath;

  int get _index {
    if (currentPath.endsWith('/cart') || currentPath.contains('/checkout')) {
      return 1;
    }
    if (currentPath.startsWith('/orders')) return 3;
    if (currentPath.startsWith('/profile')) return 4;
    return 0; // menu / outlet overview
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount = ref.watch(cartProvider).itemCount;
    return GuestFloatingNav(
      currentIndex: _index,
      onTap: (i) {
        final base = '/o/$orgSlug/$outletSlug';
        switch (i) {
          case 0:
            context.go(base);
            break;
          case 1:
            context.go('$base/cart');
            break;
          case 2:
            // Exit restaurant mode → marketplace home
            ref.read(activeOutletProvider).clear();
            context.go('/');
            break;
          case 3:
            context.push('/orders');
            break;
          case 4:
            context.push('/profile');
            break;
        }
      },
      items: [
        const GuestNavItem(
          icon: Icons.restaurant_menu_outlined,
          activeIcon: Icons.restaurant_menu_rounded,
          label: 'Menu',
        ),
        GuestNavItem(
          icon: Icons.shopping_cart_outlined,
          activeIcon: Icons.shopping_cart_rounded,
          label: cartCount > 0 ? 'Cart ($cartCount)' : 'Cart',
        ),
        const GuestNavItem(
          icon: Icons.storefront_outlined,
          activeIcon: Icons.storefront_rounded,
          label: 'Exit',
          raised: true,
        ),
        const GuestNavItem(
          icon: Icons.receipt_long_outlined,
          activeIcon: Icons.receipt_long_rounded,
          label: 'Orders',
        ),
        const GuestNavItem(
          icon: Icons.person_outline_rounded,
          activeIcon: Icons.person_rounded,
          label: 'Profile',
        ),
      ],
    );
  }
}

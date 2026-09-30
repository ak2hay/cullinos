import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';

bool isAlcoholItem(Map<String, dynamic> item) => item['isAlcohol'] == true;

/// Asks once per outlet session; the API rejects drink orders without it.
Future<bool> ensureDrinkingAge(BuildContext context, CartState cart) async {
  if (cart.ageConfirmed) return true;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Age confirmation'),
      content: const Text(
        'Please confirm you are of legal drinking age in your state. '
        'Drinks are served at the table (dine-in only).',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('I am of legal age'),
        ),
      ],
    ),
  );
  if (confirmed == true) {
    cart.confirmAge();
    return true;
  }
  return false;
}

class DineInOnlyBadge extends StatelessWidget {
  const DineInOnlyBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: GuestColors.primaryOf(context).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        'Dine-in only',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: GuestColors.primaryOf(context),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:cullinos_guest/core/guest_colors.dart';

/// Circular soft-green back control used across pushed Guest screens.
class GuestBackButton extends StatelessWidget {
  const GuestBackButton({super.key, this.fallbackPath});

  /// Used when the route stack cannot pop (e.g. deep link / `go`).
  final String? fallbackPath;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(fallbackPath ?? '/');
        }
      },
      child: Container(
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: GuestColors.primarySoftOf(context),
          shape: BoxShape.circle,
        ),
        child: Icon(
          Icons.arrow_back_rounded,
          color: GuestColors.primaryOf(context),
          size: 20,
        ),
      ),
    );
  }
}

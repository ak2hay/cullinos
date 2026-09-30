import 'package:flutter/material.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';

class WaiterSectionHeader extends StatelessWidget {
  const WaiterSectionHeader({
    super.key,
    required this.title,
    this.trailing,
  });

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: WaiterColors.inkOf(context),
            ),
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

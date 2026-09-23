import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:google_fonts/google_fonts.dart';

/// Cullinos brand wordmark for splash / home headers.
///
/// Guest marketplace uses forest-green accent on the trailing dot.
class GuestBrandWordmark extends StatelessWidget {
  const GuestBrandWordmark({
    super.key,
    this.compact = false,
    this.color,
  });

  final bool compact;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final ink = color ?? GuestColors.ink;
    final size = compact ? 20.0 : 28.0;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: 'Cullinos',
            style: GoogleFonts.plusJakartaSans(
              fontSize: size,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              color: ink,
            ),
          ),
          TextSpan(
            text: '.',
            style: GoogleFonts.plusJakartaSans(
              fontSize: size,
              fontWeight: FontWeight.w800,
              color: GuestColors.primaryOf(context),
            ),
          ),
        ],
      ),
    );
  }
}

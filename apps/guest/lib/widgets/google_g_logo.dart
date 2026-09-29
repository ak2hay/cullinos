import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Official-style multicolor Google "G" mark for sign-in buttons.
class GoogleGLogo extends StatelessWidget {
  const GoogleGLogo({super.key, this.size = 24});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GoogleGPainter()),
    );
  }
}

class _GoogleGPainter extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _green = Color(0xFF34A853);
  static const _yellow = Color(0xFFFBBC05);
  static const _red = Color(0xFFEA4335);

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width / 2;
    final stroke = r * 0.42;
    final rect = Rect.fromCircle(center: Offset(cx, cy), radius: r - stroke / 2);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    // Blue arc (right / top-right) — open gap for the bar
    paint.color = _blue;
    canvas.drawArc(rect, -math.pi / 2, math.pi * 0.55, false, paint);

    // Green arc (bottom-right)
    paint.color = _green;
    canvas.drawArc(rect, math.pi * 0.05, math.pi * 0.55, false, paint);

    // Yellow arc (bottom-left)
    paint.color = _yellow;
    canvas.drawArc(rect, math.pi * 0.6, math.pi * 0.45, false, paint);

    // Red arc (top-left)
    paint.color = _red;
    canvas.drawArc(rect, math.pi * 1.05, math.pi * 0.45, false, paint);

    // Horizontal blue bar of the G
    final barPaint = Paint()
      ..color = _blue
      ..style = PaintingStyle.fill;
    final barH = stroke;
    final barLeft = cx - r * 0.08;
    final barRight = cx + r - stroke / 2;
    canvas.drawRRect(
      RRect.fromLTRBR(
        barLeft,
        cy - barH / 2,
        barRight,
        cy + barH / 2,
        Radius.circular(barH / 4),
      ),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

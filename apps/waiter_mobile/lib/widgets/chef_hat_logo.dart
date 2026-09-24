import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Outline chef-hat mark used on the login hero.
class ChefHatLogo extends StatelessWidget {
  const ChefHatLogo({super.key, this.size = 56, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _ChefHatPainter(color)),
    );
  }
}

class _ChefHatPainter extends CustomPainter {
  _ChefHatPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final stroke = w * 0.085;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;

    var crown = Path()
      ..addOval(Rect.fromCircle(center: Offset(w * 0.28, h * 0.40), radius: w * 0.20))
      ..addOval(Rect.fromCircle(center: Offset(w * 0.50, h * 0.30), radius: w * 0.24))
      ..addOval(Rect.fromCircle(center: Offset(w * 0.72, h * 0.40), radius: w * 0.20));
    final body = Path()
      ..addRect(Rect.fromLTRB(w * 0.22, h * 0.40, w * 0.78, h * 0.72));
    crown = Path.combine(PathOperation.union, crown, body);
    final band = RRect.fromRectAndRadius(
      Rect.fromLTRB(w * 0.22, h * 0.72, w * 0.78, h * 0.90),
      Radius.circular(w * 0.05),
    );
    final hat = Path.combine(PathOperation.union, crown, Path()..addRRect(band));
    canvas.drawPath(hat, paint);

    // Band seam and a small smile-like fold
    canvas.drawLine(Offset(w * 0.24, h * 0.72), Offset(w * 0.76, h * 0.72), paint);
    canvas.drawArc(
      Rect.fromCenter(center: Offset(w * 0.5, h * 0.60), width: w * 0.22, height: h * 0.10),
      0,
      math.pi,
      false,
      paint..strokeWidth = stroke * 0.8,
    );
  }

  @override
  bool shouldRepaint(covariant _ChefHatPainter oldDelegate) => oldDelegate.color != color;
}

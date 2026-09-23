import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class ScanPage extends StatefulWidget {
  const ScanPage({super.key});

  @override
  State<ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> with TickerProviderStateMixin {
  late final MobileScannerController _controller;
  late final AnimationController _scanAnim;
  late final Animation<double> _scanLine;
  bool _handled = false;
  bool _torchOn = false;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController();
    _scanAnim = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _scanLine = Tween<double>(begin: 0.05, end: 0.95).animate(
      CurvedAnimation(parent: _scanAnim, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _scanAnim.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final raw = capture.barcodes.isEmpty
        ? null
        : capture.barcodes.first.rawValue;
    if (raw == null || raw.isEmpty) return;
    _handled = true;

    final uri = Uri.tryParse(raw);
    if (uri == null) {
      _showInvalid();
      return;
    }
    final parts = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    String? org;
    String? outlet;
    if (parts.length >= 3 && parts[0] == 'o') {
      org = parts[1];
      outlet = parts[2];
    } else if (parts.length >= 2) {
      org = parts[parts.length - 2];
      outlet = parts[parts.length - 1];
    }
    if (org == null || outlet == null) {
      _showInvalid();
      return;
    }
    HapticFeedback.mediumImpact();
    final q = uri.query;
    context.go('/o/$org/$outlet${q.isEmpty ? '' : '?$q'}');
  }

  void _showInvalid() {
    setState(() => _handled = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Invalid QR code. Please scan a Cullinos table QR.'),
        backgroundColor: Colors.red,
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _pickFromAlbum() async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(source: ImageSource.gallery);
      if (file == null) return;
      await _controller.analyzeImage(file.path);
    } catch (_) {}
  }

  Future<void> _toggleTorch() async {
    await _controller.toggleTorch();
    setState(() => _torchOn = !_torchOn);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // ── Full bleed scanner ─────────────────────────────────────────
            Positioned.fill(
              child: MobileScanner(
                controller: _controller,
                onDetect: _onDetect,
              ),
            ),
            // ── Dark vignette overlay + cutout ─────────────────────────────
            Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(
                  painter: _ScanOverlayPainter(),
                ),
              ),
            ),
            // ── Animated scan line ─────────────────────────────────────────
            Positioned.fill(
              child: IgnorePointer(
                child: AnimatedBuilder(
                  animation: _scanLine,
                  builder: (_, __) => CustomPaint(
                    painter: _ScanLinePainter(progress: _scanLine.value),
                  ),
                ),
              ),
            ),
            // ── Top bar ────────────────────────────────────────────────────
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.maybePop(context),
                      icon: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'Scan QR Code',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    const SizedBox(width: 48), // visual balance
                  ],
                ),
              ),
            ),
            // ── Bottom instruction + controls ──────────────────────────────
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Align the QR Code within the frame to scan',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _ControlButton(
                        icon: Icons.photo_library_outlined,
                        label: 'Album',
                        onTap: _pickFromAlbum,
                      ),
                      const SizedBox(width: 48),
                      _ControlButton(
                        icon: _torchOn
                            ? Icons.flash_on_rounded
                            : Icons.flash_off_rounded,
                        label: 'Light',
                        onTap: _toggleTorch,
                        active: _torchOn,
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Painters ─────────────────────────────────────────────────────────────────

class _ScanOverlayPainter extends CustomPainter {
  static const _frameSize = 240.0;
  static const _bracketLen = 28.0;
  static const _frameRadius = 12.0;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final left = cx - _frameSize / 2;
    final top = cy - _frameSize / 2;
    final frame = Rect.fromLTWH(left, top, _frameSize, _frameSize);

    // Semi-transparent dark overlay with cutout
    final overlayPaint = Paint()..color = Colors.black.withValues(alpha: 0.62);
    final path = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(
          frame, const Radius.circular(_frameRadius)));
    canvas.drawPath(path, overlayPaint);

    // Green L-bracket corners
    final bracketPaint = Paint()
      ..color = const Color(0xFF22C55E)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;

    final r = left;
    final b = top;
    final corners = [
      // top-left
      [Offset(r, b + _bracketLen), Offset(r, b), Offset(r + _bracketLen, b)],
      // top-right
      [
        Offset(r + _frameSize - _bracketLen, b),
        Offset(r + _frameSize, b),
        Offset(r + _frameSize, b + _bracketLen),
      ],
      // bottom-left
      [
        Offset(r, b + _frameSize - _bracketLen),
        Offset(r, b + _frameSize),
        Offset(r + _bracketLen, b + _frameSize),
      ],
      // bottom-right
      [
        Offset(r + _frameSize - _bracketLen, b + _frameSize),
        Offset(r + _frameSize, b + _frameSize),
        Offset(r + _frameSize, b + _frameSize - _bracketLen),
      ],
    ];
    for (final pts in corners) {
      final p = Path()..moveTo(pts[0].dx, pts[0].dy);
      for (var i = 1; i < pts.length; i++) {
        p.lineTo(pts[i].dx, pts[i].dy);
      }
      canvas.drawPath(p, bracketPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _ScanOverlayPainter old) => false;
}

class _ScanLinePainter extends CustomPainter {
  const _ScanLinePainter({required this.progress});
  final double progress;

  static const _frameSize = 240.0;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final left = cx - _frameSize / 2;
    final top = cy - _frameSize / 2;
    final y = top + _frameSize * progress;

    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          const Color(0xFF22C55E).withValues(alpha: 0.0),
          const Color(0xFF22C55E).withValues(alpha: 0.9),
          const Color(0xFF22C55E).withValues(alpha: 0.0),
        ],
      ).createShader(
        Rect.fromLTWH(left, y - 1, _frameSize, 2),
      )
      ..strokeWidth = 2.5;
    canvas.drawLine(
        Offset(left + 4, y), Offset(left + _frameSize - 4, y), paint);
  }

  @override
  bool shouldRepaint(covariant _ScanLinePainter old) =>
      old.progress != progress;
}

// ─── Helper widget ────────────────────────────────────────────────────────────

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: active
                  ? Colors.white.withValues(alpha: 0.30)
                  : Colors.white.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 28),
          ),
          const SizedBox(height: 7),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

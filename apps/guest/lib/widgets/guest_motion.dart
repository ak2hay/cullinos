import 'package:flutter/material.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';

bool _reduceMotion(BuildContext context) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// Subtle press-down scale for tappable cards and tiles.
class GuestPressable extends StatefulWidget {
  const GuestPressable({
    super.key,
    required this.child,
    this.onTap,
    this.scale = 0.97,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<GuestPressable> createState() => _GuestPressableState();
}

class _GuestPressableState extends State<GuestPressable> {
  bool _pressed = false;

  void _set(bool value) {
    if (widget.onTap == null || _pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _pressed && !_reduceMotion(context) ? widget.scale : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Replays a fade + slight scale whenever [trigger] changes, without
/// rebuilding [child] (safe for `StatefulNavigationShell`).
class GuestFadeThrough extends StatefulWidget {
  const GuestFadeThrough({
    super.key,
    required this.trigger,
    required this.child,
  });

  final Object? trigger;
  final Widget child;

  @override
  State<GuestFadeThrough> createState() => _GuestFadeThroughState();
}

class _GuestFadeThroughState extends State<GuestFadeThrough>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
    value: 1,
  );
  late final Animation<double> _curve =
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);

  @override
  void didUpdateWidget(covariant GuestFadeThrough oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.trigger != widget.trigger && !_reduceMotion(context)) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _curve,
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.985, end: 1).animate(_curve),
        child: widget.child,
      ),
    );
  }
}

/// Shimmering placeholder block.
class GuestSkeleton extends StatefulWidget {
  const GuestSkeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = GuestSpacing.radiusSm,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  State<GuestSkeleton> createState() => _GuestSkeletonState();
}

class _GuestSkeletonState extends State<GuestSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_reduceMotion(context)) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = GuestColors.borderLightOf(context);
    final highlight = GuestColors.isDark(context)
        ? Color.lerp(base, Colors.white, 0.06)!
        : Color.lerp(base, Colors.white, 0.7)!;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value * 3 - 1;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(t - 1, 0),
              end: Alignment(t + 1, 0),
              colors: [base, highlight, base],
            ),
          ),
        );
      },
    );
  }
}

/// Page-level loading layout: a banner block followed by card rows.
class GuestSkeletonList extends StatelessWidget {
  const GuestSkeletonList({super.key, this.rows = 5});

  final int rows;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(GuestSpacing.page),
      children: [
        const GuestSkeleton(height: 140, radius: GuestSpacing.radiusLg),
        const SizedBox(height: 20),
        for (var i = 0; i < rows; i++) ...[
          Container(
            padding: const EdgeInsets.all(GuestSpacing.cardPad),
            decoration: BoxDecoration(
              color: GuestColors.surfaceOf(context),
              borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
            ),
            child: const Row(
              children: [
                GuestSkeleton(width: 64, height: 64),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      GuestSkeleton(height: 14),
                      SizedBox(height: 8),
                      GuestSkeleton(width: 120, height: 12),
                      SizedBox(height: 8),
                      GuestSkeleton(width: 72, height: 12),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

/// One-shot fade + rise used for empty states and freshly loaded content.
class GuestFadeIn extends StatelessWidget {
  const GuestFadeIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.offset = 12,
  });

  final Widget child;
  final Duration delay;
  final double offset;

  @override
  Widget build(BuildContext context) {
    if (_reduceMotion(context)) return child;
    final total = const Duration(milliseconds: 320) + delay;
    final start = delay.inMilliseconds / total.inMilliseconds;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(start, 1, curve: Curves.easeOutCubic),
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * offset),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

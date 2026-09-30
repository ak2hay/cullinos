import 'package:flutter/material.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';

bool _reduceMotion(BuildContext context) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// Subtle press-down scale for tappable cards and tiles.
class WaiterPressable extends StatefulWidget {
  const WaiterPressable({
    super.key,
    required this.child,
    this.enabled = true,
    this.scale = 0.97,
  });

  final Widget child;
  final bool enabled;
  final double scale;

  @override
  State<WaiterPressable> createState() => _WaiterPressableState();
}

class _WaiterPressableState extends State<WaiterPressable> {
  bool _pressed = false;

  void _set(bool value) {
    if (!widget.enabled || _pressed == value) return;
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
class WaiterFadeThrough extends StatefulWidget {
  const WaiterFadeThrough({
    super.key,
    required this.trigger,
    required this.child,
  });

  final Object? trigger;
  final Widget child;

  @override
  State<WaiterFadeThrough> createState() => _WaiterFadeThroughState();
}

class _WaiterFadeThroughState extends State<WaiterFadeThrough>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 240),
    value: 1,
  );
  late final Animation<double> _curve =
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);

  @override
  void didUpdateWidget(covariant WaiterFadeThrough oldWidget) {
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
class WaiterSkeleton extends StatefulWidget {
  const WaiterSkeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = WaiterSpacing.radiusSm,
  });

  final double? width;
  final double? height;
  final double radius;

  @override
  State<WaiterSkeleton> createState() => _WaiterSkeletonState();
}

class _WaiterSkeletonState extends State<WaiterSkeleton>
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
    final base = WaiterColors.borderLightOf(context);
    final highlight = WaiterColors.isDark(context)
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

/// Loading placeholder for the floor grid.
class WaiterSkeletonGrid extends StatelessWidget {
  const WaiterSkeletonGrid({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(WaiterSpacing.page),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: wide ? 3 : 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: wide ? 1.35 : 1.15,
      ),
      itemCount: count,
      itemBuilder: (_, __) => const WaiterSkeleton(
        height: null,
        radius: WaiterSpacing.radiusMd,
      ),
    );
  }
}

/// Loading placeholder for card lists (calls, orders).
class WaiterSkeletonList extends StatelessWidget {
  const WaiterSkeletonList({super.key, this.rows = 5});

  final int rows;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(WaiterSpacing.page),
      itemCount: rows,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => Container(
        padding: const EdgeInsets.all(WaiterSpacing.cardPad),
        decoration: BoxDecoration(
          color: WaiterColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(WaiterSpacing.radiusMd),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            WaiterSkeleton(width: 140, height: 16),
            SizedBox(height: 10),
            WaiterSkeleton(height: 12),
            SizedBox(height: 8),
            WaiterSkeleton(width: 90, height: 12),
          ],
        ),
      ),
    );
  }
}

/// Centered icon + message with an optional action (retry, refresh).
class WaiterEmptyState extends StatelessWidget {
  const WaiterEmptyState({
    super.key,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.all(WaiterSpacing.page),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: WaiterColors.primarySoftOf(context),
            ),
            child: Icon(icon, size: 30, color: WaiterColors.primaryOf(context)),
          ),
          const SizedBox(height: 14),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: WaiterColors.mutedOf(context),
              fontSize: 15,
              height: 1.4,
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onAction,
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
    if (_reduceMotion(context)) return Center(child: content);
    return Center(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        builder: (context, t, child) => Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 12),
            child: child,
          ),
        ),
        child: content,
      ),
    );
  }
}

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cullinos_guest/core/app_info.dart';
import 'package:cullinos_guest/core/config.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_remote_config.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/orders/push_service.dart';
import 'package:cullinos_guest/widgets/guest_brand_wordmark.dart';
import 'package:cullinos_guest/widgets/guest_gradient_card.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';

/// Splash: hydrate auth, check force-update / maintenance / soft-update.
class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with SingleTickerProviderStateMixin {
  String? _blockMessage;
  String? _playStoreUrl;
  late final AnimationController _motion;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(parent: _motion, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.86, end: 1).animate(
      CurvedAnimation(parent: _motion, curve: Curves.easeOutBack),
    );
    _motion.forward();
    _boot();
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    final auth = ref.read(authControllerProvider);
    await auth.hydrate();

    final fbUser = FirebaseAuth.instance.currentUser;
    if (fbUser != null && auth.needsBackendExchange) {
      try {
        final idToken = await fbUser.getIdToken(true);
        if (idToken != null && idToken.isNotEmpty) {
          final res = await ref
              .read(guestApiProvider)
              .exchangeFirebase(idToken: idToken)
              .timeout(const Duration(seconds: 8));
          final guest = Map<String, dynamic>.from(res['guest'] as Map);
          await auth.setSession(
            token: res['accessToken'] as String,
            guestId: guest['id'] as String,
            phone: (guest['phone'] as String?) ??
                fbUser.phoneNumber?.replaceAll(RegExp(r'\D'), '') ??
                '',
            name: guest['name'] as String?,
            email: guest['email'] as String?,
          );
        }
      } catch (_) {}
    }

    String? softUpdateMessage;
    try {
      final cfg = await ref
          .read(guestApiProvider)
          .appConfig()
          .timeout(const Duration(seconds: 4));
      ref.read(guestRemoteConfigProvider.notifier).apply(cfg);
      final minCode = (cfg['minVersionCode'] as num?)?.toInt() ?? 1;
      final force = cfg['forceUpdate'] == true;
      final maintenance = cfg['maintenanceMessage'] as String?;
      final playUrl = cfg['playStoreUrl'] as String?;
      softUpdateMessage = cfg['softUpdateMessage'] as String?;
      if (maintenance != null && maintenance.trim().isNotEmpty) {
        if (mounted) {
          setState(() {
            _blockMessage = maintenance;
            _playStoreUrl = playUrl;
          });
        }
        return;
      }
      final versionCode = GuestAppInfo.versionCode;
      if (force && versionCode < minCode) {
        if (mounted) {
          setState(() {
            _blockMessage =
                'Please update Cullinos App from the Play Store to continue.';
            _playStoreUrl = playUrl;
          });
        }
        return;
      }
      if (force ||
          versionCode >= minCode ||
          softUpdateMessage == null ||
          softUpdateMessage.trim().isEmpty) {
        softUpdateMessage = null;
      }
      _playStoreUrl = playUrl;
    } catch (_) {}

    unawaited(
      GuestPushService.instance.init(ref).timeout(
            const Duration(seconds: 3),
            onTimeout: () {},
          ),
    );

    auth.refresh();

    final softMsg = softUpdateMessage;
    final storeUrl = _playStoreUrl;
    if (softMsg != null && softMsg.trim().isNotEmpty && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        showDialog<void>(
          context: context,
          barrierDismissible: true,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
            ),
            title: const Text('Update available'),
            content: Text(softMsg),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                style: TextButton.styleFrom(
                  foregroundColor: GuestColors.muted,
                ),
                child: const Text('Later'),
              ),
              if (storeUrl != null && storeUrl.trim().isNotEmpty)
                FilledButton(
                  onPressed: () {
                    launchUrl(
                      Uri.parse(storeUrl),
                      mode: LaunchMode.externalApplication,
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: GuestColors.primary,
                  ),
                  child: const Text('Update'),
                ),
            ],
          ),
        );
      });
    }
  }

  Future<void> _openStore() async {
    final url = _playStoreUrl?.trim();
    if (url == null || url.isEmpty) return;
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    // ── Blocked (maintenance / force update) ─────────────────────────────
    if (_blockMessage != null) {
      return Scaffold(
        backgroundColor: GuestColors.scaffold,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(GuestSpacing.page),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const GuestBrandWordmark(),
                const SizedBox(height: 24),
                GuestGradientCard(
                  gradient: GuestColors.heroTeal,
                  child: Text(
                    _blockMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      height: 1.4,
                    ),
                  ),
                ),
                if (_playStoreUrl != null &&
                    _playStoreUrl!.trim().isNotEmpty) ...[
                  const SizedBox(height: 16),
                  GuestPillButton(
                    label: 'Open Play Store',
                    icon: Icons.open_in_new_rounded,
                    onPressed: _openStore,
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    // ── Splash loading ────────────────────────────────────────────────────
    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      body: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Brand icon with forest-green gradient
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    gradient: GuestColors.heroTeal,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: GuestSpacing.softShadow(
                      color: GuestColors.primary,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: const Text(
                    'C',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 44,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                const GuestBrandWordmark(),
                const SizedBox(height: 6),
                Text(
                  AppConfig.current.appName,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: GuestColors.muted,
                        fontWeight: FontWeight.w500,
                      ),
                ),
                const SizedBox(height: 32),
                const SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.6,
                    color: GuestColors.primary,
                    backgroundColor: GuestColors.primarySoft,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

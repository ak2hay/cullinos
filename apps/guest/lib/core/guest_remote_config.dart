import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Remote Cullinos App config from `/public/marketplace/app-config`.
class GuestRemoteConfig {
  const GuestRemoteConfig({
    this.softUpdateMessage,
    this.playStoreUrl,
    this.supportUrl,
    this.privacyUrl,
    this.termsUrl,
    this.featureFlags = const {},
  });

  final String? softUpdateMessage;
  final String? playStoreUrl;
  final String? supportUrl;
  final String? privacyUrl;
  final String? termsUrl;
  final Map<String, dynamic> featureFlags;

  factory GuestRemoteConfig.fromJson(Map<String, dynamic> cfg) {
    final flags = cfg['featureFlags'];
    return GuestRemoteConfig(
      softUpdateMessage: cfg['softUpdateMessage'] as String?,
      playStoreUrl: cfg['playStoreUrl'] as String?,
      supportUrl: cfg['supportUrl'] as String?,
      privacyUrl: cfg['privacyUrl'] as String?,
      termsUrl: cfg['termsUrl'] as String?,
      featureFlags: flags is Map
          ? Map<String, dynamic>.from(flags)
          : const {},
    );
  }
}

class GuestRemoteConfigNotifier extends StateNotifier<GuestRemoteConfig> {
  GuestRemoteConfigNotifier() : super(const GuestRemoteConfig());

  void apply(Map<String, dynamic> cfg) {
    state = GuestRemoteConfig.fromJson(cfg);
  }
}

final guestRemoteConfigProvider =
    StateNotifierProvider<GuestRemoteConfigNotifier, GuestRemoteConfig>(
  (ref) => GuestRemoteConfigNotifier(),
);

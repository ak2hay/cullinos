import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';

/// Blocks the app with an update dialog when build is below [AppConfig.minBuildNumber].
Future<void> checkForceUpdate(BuildContext context) async {
  final min = AppConfig.current.minBuildNumber;
  if (min <= 0) return;
  final info = await PackageInfo.fromPlatform();
  final build = int.tryParse(info.buildNumber) ?? 0;
  if (build >= min) return;
  if (!context.mounted) return;
  final l10n = AppLocalizations.of(context);
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => PopScope(
      canPop: false,
      child: AlertDialog(
        title: Text(l10n.updateRequired),
        content: Text(l10n.updateRequiredBody),
        actions: [
          FilledButton(
            onPressed: () async {
              final uri = Uri.parse(AppConfig.current.playStoreUrl);
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            },
            child: Text(l10n.updateNow),
          ),
        ],
      ),
    ),
  );
}

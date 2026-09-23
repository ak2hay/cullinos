import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/features/floor/floor_page.dart';
import 'package:cullinos_waiter/features/settings/locale_controller.dart';
import 'package:cullinos_waiter/features/settings/prefs_controller.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/waiter_section_header.dart';
import 'package:cullinos_waiter/widgets/waiter_soft_card.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  String _versionLabel = '';
  String? _pendingLocale;

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((info) {
      if (!mounted) return;
      setState(() {
        _versionLabel =
            '${info.version}+${info.buildNumber} · ${AppConfig.current.flavor}';
      });
    });
  }

  String _langLabel(AppLocalizations l10n, String code) {
    switch (code) {
      case 'hi':
        return l10n.languageHindi;
      case 'mr':
        return l10n.languageMarathi;
      case 'gu':
        return l10n.languageGujarati;
      case 'ta':
        return l10n.languageTamil;
      case 'bn':
        return l10n.languageBengali;
      case 'te':
        return l10n.languageTelugu;
      case 'kn':
        return l10n.languageKannada;
      case 'ml':
        return l10n.languageMalayalam;
      case 'pa':
        return l10n.languagePunjabi;
      default:
        return l10n.languageEnglish;
    }
  }

  Future<void> _confirmLocale() async {
    final code = _pendingLocale;
    if (code == null) return;
    await ref.read(localeControllerProvider).setLocale(Locale(code));
    if (!mounted) return;
    setState(() => _pendingLocale = null);
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.languageChanged)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final localeCtrl = ref.watch(localeControllerProvider);
    final prefs = ref.watch(prefsControllerProvider);
    final outlets = ref.watch(outletsProvider);
    final currentCode = localeCtrl.locale.languageCode;
    final previewCode = _pendingLocale ?? currentCode;
    final hasPending =
        _pendingLocale != null && _pendingLocale != currentCode;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6F8),
      appBar: AppBar(
        title: Text(l10n.settings),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(WaiterSpacing.page),
        children: [
          WaiterSectionHeader(title: l10n.profile),
          const SizedBox(height: 10),
          WaiterSoftCard(
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: WaiterColors.primary.withValues(alpha: 0.15),
                  child: Text(
                    (auth.name ?? '?').trim().isEmpty
                        ? '?'
                        : auth.name!.trim()[0].toUpperCase(),
                    style: const TextStyle(
                      color: WaiterColors.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(auth.name ?? '—',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(auth.email ?? '',
                          style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          WaiterSectionHeader(title: l10n.outlet),
          const SizedBox(height: 10),
          WaiterSoftCard(
            child: outlets.when(
              data: (list) {
                final selected =
                    list.any((o) => o['id'] == auth.selectedOutletId)
                        ? auth.selectedOutletId
                        : null;
                return InputDecorator(
                  decoration: InputDecoration(labelText: l10n.selectOutlet),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: selected,
                      items: list
                          .map(
                            (o) => DropdownMenuItem(
                              value: o['id']?.toString(),
                              child: Text(o['name']?.toString() ?? ''),
                            ),
                          )
                          .toList(),
                      onChanged: (id) =>
                          ref.read(authControllerProvider).setOutlet(id),
                    ),
                  ),
                );
              },
              loading: () => Text(l10n.loading),
              error: (_, __) => Text(l10n.errorGeneric),
            ),
          ),
          const SizedBox(height: 24),
          WaiterSectionHeader(title: l10n.language),
          const SizedBox(height: 10),
          WaiterSoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                InputDecorator(
                  decoration: InputDecoration(labelText: l10n.language),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: previewCode,
                      items: LocaleController.supported
                          .map(
                            (l) => DropdownMenuItem(
                              value: l.languageCode,
                              child: Text(_langLabel(l10n, l.languageCode)),
                            ),
                          )
                          .toList(),
                      onChanged: (code) {
                        if (code == null) return;
                        setState(() {
                          _pendingLocale =
                              code == currentCode ? null : code;
                        });
                      },
                    ),
                  ),
                ),
                if (hasPending) ...[
                  const SizedBox(height: 12),
                  FutureBuilder<AppLocalizations>(
                    future: AppLocalizations.delegate.load(Locale(previewCode)),
                    builder: (context, snap) {
                      final preview = snap.data;
                      if (preview == null) {
                        return const SizedBox.shrink();
                      }
                      return Text(
                        '${preview.language}: ${_langLabel(preview, previewCode)}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () =>
                              setState(() => _pendingLocale = null),
                          child: Text(l10n.cancel),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _confirmLocale,
                          child: Text(l10n.confirmLanguage),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          WaiterSoftCard(
            child: Column(
              children: [
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.callSound),
                  value: prefs.callSound,
                  onChanged: (v) =>
                      ref.read(prefsControllerProvider).setCallSound(v),
                ),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.callHaptic),
                  value: prefs.callHaptic,
                  onChanged: (v) =>
                      ref.read(prefsControllerProvider).setCallHaptic(v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text('${l10n.version} ${_versionLabel.isEmpty ? '…' : _versionLabel}'),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              await ref.read(authControllerProvider).logout();
              if (context.mounted) context.go('/login');
            },
            child: Text(l10n.logout),
          ),
        ],
      ),
    );
  }
}

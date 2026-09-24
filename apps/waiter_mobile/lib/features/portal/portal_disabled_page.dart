import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/portal_status.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';

class PortalDisabledPage extends ConsumerWidget {
  const PortalDisabledPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final portal = ref.watch(portalStatusProvider);
    final serverMessage = portal.disabledMessage?.trim() ?? '';

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.block, size: 56, color: WaiterColors.primary),
                  const SizedBox(height: 16),
                  Text(
                    l10n.portalDisabledTitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(l10n.portalDisabledBody, textAlign: TextAlign.center),
                  if (serverMessage.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      serverMessage,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: portal.checking
                        ? null
                        : () => ref.read(portalStatusProvider).check(ref.read(dioProvider)),
                    child: portal.checking
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(l10n.checkAgain),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/portal_status.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';

class PortalMaintenancePage extends ConsumerWidget {
  const PortalMaintenancePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final portal = ref.watch(portalStatusProvider);
    final serverMessage = portal.maintenanceMessage?.trim() ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFF1A1408),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    l10n.portalMaintenanceLabel,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: WaiterColors.amber,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Icon(Icons.construction_rounded, size: 56, color: WaiterColors.amber),
                  const SizedBox(height: 16),
                  Text(
                    l10n.portalMaintenanceTitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    l10n.portalMaintenanceBody,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white70,
                        ),
                  ),
                  if (serverMessage.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      serverMessage,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.white60,
                          ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: WaiterColors.amber,
                      foregroundColor: Colors.black,
                    ),
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

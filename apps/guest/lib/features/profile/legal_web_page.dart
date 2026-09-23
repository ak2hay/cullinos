import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

/// Opens Cullinos legal pages (privacy / terms) via external browser with
/// a simple in-app chrome if launch fails.
class LegalWebPage extends StatelessWidget {
  const LegalWebPage({
    super.key,
    required this.title,
    required this.url,
  });

  final String title;
  final String url;

  Future<void> _open() async {
    final uri = Uri.parse(url);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: GuestColors.scaffold,
        foregroundColor: GuestColors.ink,
        elevation: 0,
        leading: const GuestBackButton(fallbackPath: '/profile'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(GuestSpacing.page),
        child: GuestSoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'View the full document on cullinos.com.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: GuestColors.muted,
                    ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _open,
                style: FilledButton.styleFrom(
                  backgroundColor: GuestColors.violet,
                  minimumSize: const Size.fromHeight(48),
                  shape: const StadiumBorder(),
                ),
                child: const Text('Open in browser'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

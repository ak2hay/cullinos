import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Listens for Android App Links / custom scheme and routes into GoRouter.
class GuestDeepLinkListener {
  GuestDeepLinkListener._();
  static final GuestDeepLinkListener instance = GuestDeepLinkListener._();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;
  bool _started = false;

  Future<void> start(GoRouter router) async {
    if (_started) return;
    _started = true;

    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        _navigate(router, initial);
      }
    } catch (_) {}

    _sub = _appLinks.uriLinkStream.listen((uri) {
      _navigate(router, uri);
    });
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
    _started = false;
  }

  void _navigate(GoRouter router, Uri uri) {
    final path = mapDeepLinkToLocation(uri);
    if (path == null || path.isEmpty) return;
    // Defer until after first frame so navigator is ready.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      router.go(path);
    });
  }
}

/// Maps incoming deep links to in-app locations.
///
/// Supports:
/// - https://guest.cullinos.com/o/{org}/{outlet}?table=&session=
/// - https://guest.cullinos.com/o/{org}/{outlet}?table=&session= (legacy get-app also accepted)
/// - cullinos://outlet/{org}/{outlet}?table=&session=
String? mapDeepLinkToLocation(Uri uri) {
  final host = uri.host.toLowerCase();
  final scheme = uri.scheme.toLowerCase();

  if (scheme == 'cullinos' && (host == 'outlet' || uri.pathSegments.isNotEmpty)) {
    final parts = <String>[
      if (host != 'outlet' && host.isNotEmpty) host,
      ...uri.pathSegments.where((s) => s.isNotEmpty),
    ];
    // cullinos://outlet/org/outlet
    if (parts.isNotEmpty && parts.first == 'outlet') {
      parts.removeAt(0);
    }
    if (parts.length >= 2) {
      return _outletLocation(parts[0], parts[1], uri.queryParameters);
    }
    return null;
  }

  if (host == 'guest.cullinos.com' ||
      host == 'www.cullinos.com' ||
      host == 'cullinos.com') {
    final segs = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (segs.isNotEmpty && segs.first == 'book') {
      final q = uri.queryParameters;
      final params = <String, String>{};
      if ((q['invite'] ?? '').isNotEmpty) params['invite'] = q['invite']!;
      if ((q['orgSlug'] ?? '').isNotEmpty) params['orgSlug'] = q['orgSlug']!;
      if ((q['outletSlug'] ?? '').isNotEmpty) {
        params['outletSlug'] = q['outletSlug']!;
      }
      final qs = params.isEmpty
          ? ''
          : '?${params.entries.map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}').join('&')}';
      return '/book$qs';
    }
    if (segs.length >= 3 && segs[0] == 'o') {
      return _outletLocation(segs[1], segs[2], uri.queryParameters);
    }
    if (segs.isNotEmpty && segs.first == 'get') {
      final org = uri.queryParameters['org'] ?? uri.queryParameters['orgSlug'];
      final outlet =
          uri.queryParameters['outlet'] ?? uri.queryParameters['outletSlug'];
      if (org != null &&
          org.isNotEmpty &&
          outlet != null &&
          outlet.isNotEmpty) {
        return _outletLocation(org, outlet, uri.queryParameters);
      }
    }
  }

  if (host == 'order.cullinos.com' &&
      uri.pathSegments.isNotEmpty &&
      uri.pathSegments.first == 'get-app') {
    final org = uri.queryParameters['org'] ?? uri.queryParameters['orgSlug'];
    final outlet =
        uri.queryParameters['outlet'] ?? uri.queryParameters['outletSlug'];
    if (org != null &&
        org.isNotEmpty &&
        outlet != null &&
        outlet.isNotEmpty) {
      return _outletLocation(org, outlet, uri.queryParameters);
    }
  }

  return null;
}

String _outletLocation(
  String org,
  String outlet,
  Map<String, String> query,
) {
  final q = <String, String>{};
  if ((query['session'] ?? '').isNotEmpty) q['session'] = query['session']!;
  if ((query['table'] ?? '').isNotEmpty) q['table'] = query['table']!;
  final qs = q.isEmpty
      ? ''
      : '?${q.entries.map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}').join('&')}';
  return '/o/${Uri.encodeComponent(org)}/${Uri.encodeComponent(outlet)}$qs';
}

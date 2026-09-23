import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Cloudflare Turnstile via WebView. Site key from `--dart-define=TURNSTILE_SITE_KEY=...`
class TurnstileField extends StatefulWidget {
  const TurnstileField({
    super.key,
    required this.onToken,
    this.onExpire,
    this.height = 72,
  });

  final ValueChanged<String> onToken;
  final VoidCallback? onExpire;
  final double height;

  static String get siteKey =>
      const String.fromEnvironment('TURNSTILE_SITE_KEY', defaultValue: '');

  static bool get isEnabled => siteKey.isNotEmpty;

  @override
  State<TurnstileField> createState() => _TurnstileFieldState();
}

class _TurnstileFieldState extends State<TurnstileField> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..addJavaScriptChannel(
        'TurnstileBridge',
        onMessageReceived: (msg) {
          try {
            final data = jsonDecode(msg.message) as Map<String, dynamic>;
            final type = data['type']?.toString();
            if (type == 'token') {
              widget.onToken(data['token']?.toString() ?? '');
            } else if (type == 'expire' || type == 'error') {
              widget.onExpire?.call();
            }
          } catch (_) {
            widget.onExpire?.call();
          }
        },
      )
      ..loadHtmlString(_html(TurnstileField.siteKey));
  }

  static String _html(String siteKey) {
    final escaped = const HtmlEscape().convert(siteKey);
    return '''
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; }
    #cf { display: flex; justify-content: center; }
  </style>
</head>
<body>
  <div id="cf"></div>
  <script>
    function notify(payload) {
      TurnstileBridge.postMessage(JSON.stringify(payload));
    }
    function renderWhenReady() {
      if (!window.turnstile) {
        setTimeout(renderWhenReady, 50);
        return;
      }
      turnstile.render('#cf', {
        sitekey: '$escaped',
        callback: function(token) { notify({ type: 'token', token: token }); },
        'expired-callback': function() { notify({ type: 'expire' }); },
        'error-callback': function() { notify({ type: 'error' }); },
        theme: 'auto'
      });
    }
    renderWhenReady();
  </script>
</body>
</html>
''';
  }

  @override
  Widget build(BuildContext context) {
    if (!TurnstileField.isEnabled) return const SizedBox.shrink();
    return SizedBox(
      height: widget.height,
      width: double.infinity,
      child: WebViewWidget(controller: _controller),
    );
  }
}

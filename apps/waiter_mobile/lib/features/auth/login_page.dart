import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/data/waiter_api.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/phone_field.dart';
import 'package:cullinos_waiter/widgets/turnstile_field.dart';
import 'package:cullinos_waiter/widgets/waiter_soft_card.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _otp = TextEditingController();
  bool _useEmail = false;
  bool _remember = true;
  bool _loading = false;
  String? _error;
  String? _challengeToken;
  bool _phoneOtpMode = false;
  String _composedPhone = '';
  bool _showPassword = false;
  String _captchaToken = '';

  bool get _captchaOk =>
      !TurnstileField.isEnabled || _captchaToken.isNotEmpty;

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _applyAuth(Map<String, dynamic> raw) async {
    final user = Map<String, dynamic>.from(raw['user'] as Map? ?? {});
    final perms = (raw['permissions'] as List?)?.map((e) => e.toString()).toList() ??
        (user['permissions'] as List?)?.map((e) => e.toString()).toList() ??
        <String>[];
    await ref.read(authControllerProvider).setSession(
          accessToken: raw['accessToken']?.toString() ?? '',
          refreshToken: raw['refreshToken']?.toString(),
          userId: user['id']?.toString(),
          email: user['email']?.toString(),
          name: user['name']?.toString() ?? user['firstName']?.toString(),
          permissions: perms,
          remember: _remember,
        );
    try {
      final preferred = raw['defaultOutletId']?.toString() ??
          user['defaultOutletId']?.toString();
      final outlets = await ref.read(waiterApiProvider).outlets();
      final active = outlets
          .map((e) => Map<String, dynamic>.from(e as Map))
          .where((o) => o['isActive'] != false)
          .toList();
      String? pick;
      if (preferred != null &&
          preferred.isNotEmpty &&
          active.any((o) => o['id']?.toString() == preferred)) {
        pick = preferred;
      } else if (active.isNotEmpty) {
        pick = active.first['id']?.toString();
      }
      if (pick != null) {
        await ref.read(authControllerProvider).setOutlet(pick);
      }
    } catch (_) {}
    if (mounted) context.go('/');
  }

  Future<void> _requestPhoneOtp() async {
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(waiterApiProvider).requestPhoneOtp(
            _composedPhone.isNotEmpty ? _composedPhone : _phone.text,
            captchaToken: _captchaToken.isEmpty ? null : _captchaToken,
          );
      setState(() {
        _challengeToken = res['challengeToken']?.toString();
        _phoneOtpMode = true;
      });
    } catch (e) {
      setState(() => _error = friendlyDioError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyPhoneOtp() async {
    if (_challengeToken == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(waiterApiProvider).verifyPhoneOtp(
            challengeToken: _challengeToken!,
            otp: _otp.text.trim(),
          );
      await _applyAuth(res);
    } catch (e) {
      setState(() => _error = friendlyDioError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginEmail() async {
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(waiterApiProvider).login(
            _email.text,
            _password.text,
            captchaToken: _captchaToken.isEmpty ? null : _captchaToken,
          );
      if (res['requiresOtp'] == true) {
        setState(() {
          _challengeToken = res['challengeToken']?.toString();
          _phoneOtpMode = false;
        });
        return;
      }
      await _applyAuth(res);
    } catch (e) {
      setState(() => _error = friendlyDioError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyEmailOtp() async {
    if (_challengeToken == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(waiterApiProvider).verifyOtp(
            challengeToken: _challengeToken!,
            otp: _otp.text.trim(),
          );
      await _applyAuth(res);
    } catch (e) {
      setState(() => _error = friendlyDioError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _resetChallenge() {
    setState(() {
      _challengeToken = null;
      _phoneOtpMode = false;
      _otp.clear();
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(WaiterSpacing.page),
              child: WaiterSoftCard(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.appTitle,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: WaiterColors.ink,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _useEmail ? l10n.email : l10n.phone,
                      style: const TextStyle(
                        color: WaiterColors.muted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 20),
                    if (_challengeToken == null) ...[
                      if (!_useEmail) ...[
                        PhoneField(
                          controller: _phone,
                          labelText: l10n.phone,
                          textInputAction: TextInputAction.done,
                          onComposedChanged: (v) =>
                              setState(() => _composedPhone = v),
                          onSubmitted: (_) =>
                              _loading ? null : _requestPhoneOtp(),
                        ),
                        if (TurnstileField.isEnabled) ...[
                          const SizedBox(height: 12),
                          TurnstileField(
                            onToken: (t) => setState(() => _captchaToken = t),
                            onExpire: () => setState(() => _captchaToken = ''),
                          ),
                        ],
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title: Text(l10n.keepSignedIn),
                          value: _remember,
                          onChanged: (v) => setState(() => _remember = v),
                        ),
                        if (_error != null)
                          Text(_error!,
                              style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: _loading ? null : _requestPhoneOtp,
                          child: Text(_loading ? l10n.loading : l10n.sendOtp),
                        ),
                        TextButton(
                          onPressed: _loading
                              ? null
                              : () => setState(() {
                                    _useEmail = true;
                                    _error = null;
                                  }),
                          child: Text(l10n.useEmailInstead),
                        ),
                      ] else ...[
                        TextField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(labelText: l10n.email),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _password,
                          obscureText: !_showPassword,
                          decoration: InputDecoration(
                            labelText: l10n.password,
                            suffixIcon: IconButton(
                              tooltip: _showPassword
                                  ? 'Hide password'
                                  : 'Show password',
                              onPressed: () => setState(
                                () => _showPassword = !_showPassword,
                              ),
                              icon: Icon(
                                _showPassword
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                              ),
                            ),
                          ),
                        ),
                        if (TurnstileField.isEnabled) ...[
                          const SizedBox(height: 12),
                          TurnstileField(
                            onToken: (t) => setState(() => _captchaToken = t),
                            onExpire: () => setState(() => _captchaToken = ''),
                          ),
                        ],
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title: Text(l10n.keepSignedIn),
                          value: _remember,
                          onChanged: (v) => setState(() => _remember = v),
                        ),
                        if (_error != null)
                          Text(_error!,
                              style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: _loading ? null : _loginEmail,
                          child: Text(_loading ? l10n.loading : l10n.login),
                        ),
                        TextButton(
                          onPressed: _loading
                              ? null
                              : () => setState(() {
                                    _useEmail = false;
                                    _error = null;
                                  }),
                          child: Text(l10n.usePhoneInstead),
                        ),
                      ],
                    ] else ...[
                      TextField(
                        controller: _otp,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(labelText: l10n.otpCode),
                      ),
                      if (_error != null)
                        Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _loading
                            ? null
                            : (_phoneOtpMode ? _verifyPhoneOtp : _verifyEmailOtp),
                        child: Text(_loading ? l10n.loading : l10n.verifyOtp),
                      ),
                      if (!_phoneOtpMode)
                        TextButton(
                          onPressed: _loading
                              ? null
                              : () async {
                                  try {
                                    await ref
                                        .read(waiterApiProvider)
                                        .resendOtp(_challengeToken!);
                                  } catch (e) {
                                    setState(
                                        () => _error = friendlyDioError(e));
                                  }
                                },
                          child: Text(l10n.resendOtp),
                        )
                      else
                        TextButton(
                          onPressed: _loading ? null : _requestPhoneOtp,
                          child: Text(l10n.resendOtp),
                        ),
                      TextButton(
                        onPressed: _loading ? null : _resetChallenge,
                        child: Text(l10n.cancel),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

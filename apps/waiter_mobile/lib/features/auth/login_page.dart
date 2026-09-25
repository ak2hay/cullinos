import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';
import 'package:cullinos_waiter/data/waiter_api.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';
import 'package:cullinos_waiter/widgets/chef_hat_logo.dart';
import 'package:cullinos_waiter/widgets/phone_field.dart';
import 'package:cullinos_waiter/widgets/turnstile_field.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  static const _resendSeconds = 30;
  static const _heroHeight = 300.0;

  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _otp = TextEditingController();
  bool _useEmail = false;
  bool _remember = true;
  bool _loading = false;
  String? _error;
  String? _hint;
  String? _challengeToken;
  bool _phoneOtpMode = false;
  String _composedPhone = '';
  bool _showPassword = false;
  String _captchaToken = '';
  int _resendIn = 0;
  Timer? _resendTimer;

  bool get _captchaOk =>
      !TurnstileField.isEnabled || _captchaToken.isNotEmpty;

  @override
  void dispose() {
    _resendTimer?.cancel();
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    _otp.dispose();
    super.dispose();
  }

  void _startResendCountdown() {
    _resendTimer?.cancel();
    setState(() => _resendIn = _resendSeconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _resendIn = _resendIn > 0 ? _resendIn - 1 : 0);
      if (_resendIn == 0) t.cancel();
    });
  }

  void _setError(Object e, {bool phoneStep = false}) {
    final msg = friendlyDioError(e);
    setState(() {
      _error = msg;
      _hint = phoneStep && msg.toLowerCase().contains('invalid phone')
          ? 'Ask your manager to add this phone number to your staff profile (Admin → Staff).'
          : null;
    });
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
    if (_loading) return;
    final phone = _composedPhone.isNotEmpty ? _composedPhone : _phone.text;
    if (phone.replaceAll(RegExp(r'\D'), '').length < 10) {
      setState(() {
        _error = 'Enter a valid phone number';
        _hint = null;
      });
      return;
    }
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _hint = null;
    });
    try {
      final res = await ref.read(waiterApiProvider).requestPhoneOtp(
            phone,
            captchaToken: _captchaToken.isEmpty ? null : _captchaToken,
          );
      // Sandbox orgs skip SMS and sign in directly.
      if ((res['accessToken']?.toString() ?? '').isNotEmpty) {
        await _applyAuth(res);
        return;
      }
      final token = res['challengeToken']?.toString();
      if (token == null || token.isEmpty) {
        setState(() => _error = 'Could not send OTP. Try again.');
        return;
      }
      setState(() {
        _challengeToken = token;
        _phoneOtpMode = true;
        _otp.clear();
      });
      _startResendCountdown();
    } catch (e) {
      _setError(e, phoneStep: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyPhoneOtp() async {
    if (_challengeToken == null || _loading) return;
    if (_otp.text.trim().length != 6) {
      setState(() => _error = 'Enter the 6-digit OTP');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _hint = null;
    });
    try {
      final res = await ref.read(waiterApiProvider).verifyPhoneOtp(
            challengeToken: _challengeToken!,
            otp: _otp.text.trim(),
          );
      await _applyAuth(res);
    } catch (e) {
      _setError(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginEmail() async {
    if (_loading) return;
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _hint = null;
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
          _otp.clear();
        });
        _startResendCountdown();
        return;
      }
      await _applyAuth(res);
    } catch (e) {
      _setError(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyEmailOtp() async {
    if (_challengeToken == null || _loading) return;
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
      _setError(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    if (_loading || _resendIn > 0) return;
    if (_phoneOtpMode) {
      await _requestPhoneOtp();
      return;
    }
    try {
      await ref.read(waiterApiProvider).resendOtp(_challengeToken!);
      _startResendCountdown();
    } catch (e) {
      _setError(e);
    }
  }

  void _resetChallenge() {
    _resendTimer?.cancel();
    setState(() {
      _challengeToken = null;
      _phoneOtpMode = false;
      _resendIn = 0;
      _otp.clear();
      _error = null;
      _hint = null;
    });
  }

  void _switchMode(bool useEmail) {
    setState(() {
      _useEmail = useEmail;
      _error = null;
      _hint = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final width = MediaQuery.sizeOf(context).width;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        child: Stack(
          children: [
            _Hero(height: _heroHeight, appTitle: l10n.appTitle),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    width < 380 ? 14 : 20,
                    _heroHeight - 40,
                    width < 380 ? 14 : 20,
                    24,
                  ),
                  child: _card(l10n),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(AppLocalizations l10n) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Welcome to',
            style: TextStyle(fontSize: 16, color: WaiterColors.muted),
          ),
          const SizedBox(height: 2),
          Text(
            l10n.appTitle,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: WaiterColors.ink,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _challengeToken != null
                ? (_phoneOtpMode
                    ? 'Enter the SMS code we sent to your phone'
                    : 'Enter the code we emailed you')
                : 'Sign in to continue',
            style: const TextStyle(fontSize: 14, color: WaiterColors.muted),
          ),
          const SizedBox(height: 22),
          if (_challengeToken != null)
            ..._otpStep(l10n)
          else if (_useEmail)
            ..._emailStep(l10n)
          else
            ..._phoneStep(l10n),
          if (_error != null) ...[
            const SizedBox(height: 14),
            _ErrorBanner(message: _error!, hint: _hint),
          ],
          const SizedBox(height: 18),
          const _FooterIllustration(),
        ],
      ),
    );
  }

  List<Widget> _phoneStep(AppLocalizations l10n) => [
        PhoneField(
          controller: _phone,
          labelText: 'Phone Number',
          textInputAction: TextInputAction.done,
          enabled: !_loading,
          onComposedChanged: (v) => setState(() => _composedPhone = v),
          onSubmitted: (_) => _requestPhoneOtp(),
        ),
        const SizedBox(height: 8),
        const Text(
          'We will send a one-time code by SMS to this number.',
          style: TextStyle(fontSize: 12, color: WaiterColors.muted),
        ),
        ..._captcha(),
        const SizedBox(height: 6),
        _rememberSwitch(l10n),
        const SizedBox(height: 10),
        _PrimaryButton(
          label: l10n.sendOtp,
          loading: _loading,
          onPressed: _requestPhoneOtp,
        ),
        const SizedBox(height: 16),
        const _OrDivider(),
        const SizedBox(height: 16),
        _OutlineButton(
          icon: Icons.mail_outline_rounded,
          label: l10n.useEmailInstead,
          onPressed: _loading ? null : () => _switchMode(true),
        ),
      ];

  List<Widget> _emailStep(AppLocalizations l10n) => [
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: _inputDecoration(l10n.email, Icons.mail_outline_rounded),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _password,
          obscureText: !_showPassword,
          onSubmitted: (_) => _loginEmail(),
          decoration: _inputDecoration(l10n.password, Icons.lock_outline_rounded).copyWith(
            suffixIcon: IconButton(
              tooltip: _showPassword ? 'Hide password' : 'Show password',
              onPressed: () => setState(() => _showPassword = !_showPassword),
              icon: Icon(
                _showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'After password, we email a one-time code to this address (not SMS).',
          style: TextStyle(fontSize: 12, color: WaiterColors.muted),
        ),
        ..._captcha(),
        const SizedBox(height: 6),
        _rememberSwitch(l10n),
        const SizedBox(height: 10),
        _PrimaryButton(
          label: l10n.login,
          loading: _loading,
          onPressed: _loginEmail,
        ),
        const SizedBox(height: 16),
        const _OrDivider(),
        const SizedBox(height: 16),
        _OutlineButton(
          icon: Icons.phone_outlined,
          label: l10n.usePhoneInstead,
          onPressed: _loading ? null : () => _switchMode(false),
        ),
      ];

  List<Widget> _otpStep(AppLocalizations l10n) => [
        TextField(
          controller: _otp,
          autofocus: true,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(
            fontSize: 24,
            letterSpacing: 10,
            fontWeight: FontWeight.w700,
          ),
          onSubmitted: (_) => _phoneOtpMode ? _verifyPhoneOtp() : _verifyEmailOtp(),
          decoration: _inputDecoration(l10n.otpCode, Icons.password_rounded)
              .copyWith(counterText: ''),
        ),
        const SizedBox(height: 14),
        _PrimaryButton(
          label: l10n.verifyOtp,
          loading: _loading,
          onPressed: _phoneOtpMode ? _verifyPhoneOtp : _verifyEmailOtp,
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: _loading ? null : _resetChallenge,
              child: Text(l10n.cancel),
            ),
            TextButton(
              onPressed: (_loading || _resendIn > 0) ? null : _resend,
              child: Text(
                _resendIn > 0 ? '${l10n.resendOtp} (${_resendIn}s)' : l10n.resendOtp,
              ),
            ),
          ],
        ),
      ];

  List<Widget> _captcha() => [
        if (TurnstileField.isEnabled) ...[
          const SizedBox(height: 12),
          TurnstileField(
            onToken: (t) => setState(() => _captchaToken = t),
            onExpire: () => setState(() => _captchaToken = ''),
          ),
        ],
      ];

  Widget _rememberSwitch(AppLocalizations l10n) {
    return Row(
      children: [
        Switch.adaptive(
          value: _remember,
          activeTrackColor: WaiterColors.primary,
          onChanged: (v) => setState(() => _remember = v),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            l10n.keepSignedIn,
            style: const TextStyle(fontSize: 14, color: WaiterColors.ink),
          ),
        ),
      ],
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon) {
    final radius = BorderRadius.circular(14);
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, color: WaiterColors.primary, size: 20),
      contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: WaiterColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: const BorderSide(color: WaiterColors.primary, width: 1.6),
      ),
      border: OutlineInputBorder(borderRadius: radius),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.height, required this.appTitle});

  final double height;
  final String appTitle;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'assets/images/login_hero.jpg',
            fit: BoxFit.cover,
            alignment: Alignment.centerRight,
            errorBuilder: (_, __, ___) => Container(color: WaiterColors.primarySoft),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  Colors.white.withValues(alpha: 0.92),
                  Colors.white.withValues(alpha: 0.55),
                  Colors.white.withValues(alpha: 0.0),
                ],
                stops: const [0.0, 0.5, 0.85],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(22, top + 22, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const ChefHatLogo(size: 58, color: WaiterColors.primaryDeep),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Cullinos',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 32,
                            height: 1.0,
                            fontWeight: FontWeight.w800,
                            color: WaiterColors.primaryDeep,
                            letterSpacing: -0.8,
                          ),
                        ),
                        const Text(
                          'Waiter App',
                          style: TextStyle(
                            fontSize: 17,
                            color: WaiterColors.ink,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Text(
                  'Faster service.\nHappier guests.',
                  style: TextStyle(
                    fontSize: 16,
                    height: 1.35,
                    color: WaiterColors.ink,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  width: 44,
                  height: 3,
                  decoration: BoxDecoration(
                    color: WaiterColors.primaryBright,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: WaiterColors.primaryDeep,
          disabledBackgroundColor: WaiterColors.primaryDeep.withValues(alpha: 0.6),
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(horizontal: 10),
        ),
        child: Row(
          children: [
            const SizedBox(width: 40),
            Expanded(
              child: Center(
                child: loading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        label,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}

class _OutlineButton extends StatelessWidget {
  const _OutlineButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, color: WaiterColors.primaryDeep),
        label: Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: WaiterColors.primaryDeep,
          ),
        ),
        style: OutlinedButton.styleFrom(
          backgroundColor: WaiterColors.primarySoft.withValues(alpha: 0.5),
          side: const BorderSide(color: WaiterColors.primary, width: 1.2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(child: Divider(color: WaiterColors.border)),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 14),
          child: Text('or', style: TextStyle(color: WaiterColors.muted)),
        ),
        Expanded(child: Divider(color: WaiterColors.border)),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, this.hint});

  final String message;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFDECEC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_rounded, color: Color(0xFFD32F2F), size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message,
                  style: const TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.w500),
                ),
                if (hint != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    hint!,
                    style: const TextStyle(color: Color(0xFF8E3B3B), fontSize: 12.5),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FooterIllustration extends StatelessWidget {
  const _FooterIllustration();

  @override
  Widget build(BuildContext context) {
    final c = WaiterColors.primary.withValues(alpha: 0.22);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Icon(Icons.storefront_outlined, size: 40, color: c),
        const SizedBox(width: 6),
        Icon(Icons.table_restaurant_outlined, size: 34, color: c),
        const SizedBox(width: 4),
        Icon(Icons.local_florist_outlined, size: 26, color: c),
        const Spacer(),
        Text(
          'Great food starts\nwith a great team',
          textAlign: TextAlign.right,
          style: GoogleFonts.caveat(
            fontSize: 17,
            height: 1.05,
            color: WaiterColors.primary.withValues(alpha: 0.45),
          ),
        ),
      ],
    );
  }
}

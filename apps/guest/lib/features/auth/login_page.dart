import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cullinos_guest/core/firebase/firebase_auth_service.dart';
import 'package:cullinos_guest/core/firebase/guest_firestore_service.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/orders/push_service.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/phone_field.dart';
import 'package:cullinos_guest/widgets/turnstile_field.dart';

String friendlyAuthError(Object e) {
  if (e is StateError) {
    final msg = e.message.trim();
    if (msg.isNotEmpty) return msg;
  }
  if (e is DioException) {
    final status = e.response?.statusCode;
    final data = e.response?.data;
    String? serverMsg;
    if (data is Map) {
      final err = data['error'];
      if (err is Map && err['message'] is String) {
        serverMsg = err['message'] as String;
      } else if (data['message'] is String) {
        serverMsg = data['message'] as String;
      }
    }
    if (status == 404) {
      return 'Service unavailable. Please try again later.';
    }
    if (status == 401) {
      return serverMsg ?? 'Incorrect code or PIN. Try again.';
    }
    if (status == 400) {
      return serverMsg ?? 'Check your mobile number and try again.';
    }
    if (status == 429) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (status == 503) {
      return serverMsg ?? 'SMS is temporarily unavailable. Try again shortly.';
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return 'No internet connection. Check your network.';
    }
    return serverMsg ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

enum _AuthStep {
  phone,
  method,
  otp,
  pinSetup,
  pinLogin,
  email,
  emailRegister,
}

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key, this.nextPath});

  final String? nextPath;

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  static const _heroHeight = 330.0;

  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _pin = TextEditingController();
  final _pinConfirm = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  _AuthStep _step = _AuthStep.phone;
  String? _verificationId; // Firebase only (unused for MSG91 phone)
  int? _resendToken;
  String? _error;
  bool _loading = false;
  bool _exists = false;
  bool _hasPin = false;
  bool _acceptedTerms = false;
  bool _staySignedIn = true;
  String? _pendingToken;
  Map<String, dynamic>? _pendingGuest;
  String? _msg91ReqId;
  bool _otpSent = false;
  String _composedPhone = '';
  bool _showPassword = false;
  bool _showPin = false;
  bool _showPinConfirm = false;
  String _captchaToken = '';

  bool get _captchaOk =>
      !TurnstileField.isEnabled || _captchaToken.isNotEmpty;

  String get _digits {
    final composed = _composedPhone.replaceAll(RegExp(r'\D'), '');
    if (composed.isNotEmpty) return composed;
    return _phone.text.replaceAll(RegExp(r'\D'), '');
  }

  bool get _phoneOk {
    final d = _digits;
    return d.length >= 10 && d.length <= 15;
  }

  String get _displayPhone {
    final d = _digits;
    if (d.length == 12 && d.startsWith('91')) return '+91 ${d.substring(2)}';
    if (d.length == 10) return '+91 $d';
    return d.isEmpty ? '' : '+$d';
  }

  Future<void> _continuePhone() async {
    if (!_phoneOk) return;
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final status = await ref.read(guestApiProvider).phoneStatus(_digits);
      final exists = status['exists'] == true;
      final hasPin = status['hasPin'] == true;
      setState(() {
        _exists = exists;
        _hasPin = hasPin;
      });
      if (exists && hasPin) {
        setState(() => _step = _AuthStep.method);
        return;
      }
      await _requestOtp(silent: true);
    } catch (e) {
      setState(() {
        _error = friendlyAuthError(e);
        if (_step != _AuthStep.method) {
          _step = _AuthStep.phone;
        }
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _requestOtp({bool silent = false, bool resend = false}) async {
    if (!silent) {
      if (!_captchaOk) {
        setState(() => _error = 'Please complete the security check');
        return;
      }
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      if (!_exists && _name.text.trim().isEmpty) {
        setState(() {
          _step = _AuthStep.otp;
          _otpSent = false;
          _error = null;
          _loading = false;
        });
        return;
      }
      final api = ref.read(guestApiProvider);
      Map<String, dynamic> res;
      if (resend && _msg91ReqId != null && _msg91ReqId!.isNotEmpty) {
        res = await api.widgetRetryOtp(_msg91ReqId!);
      } else {
        res = await api.widgetSendOtp(
          _digits,
          captchaToken: _captchaToken.isEmpty ? null : _captchaToken,
        );
      }
      final reqId = res['reqId']?.toString();
      if (reqId == null || reqId.isEmpty) {
        throw StateError('Could not start phone verification. Please try again.');
      }
      if (!mounted) return;
      setState(() {
        _msg91ReqId = reqId;
        _otpSent = true;
        _step = _AuthStep.otp;
        _error = null;
        _code.clear();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyAuthError(e));
      if (silent) rethrow;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _applyGuestSession(Map<String, dynamic> res) async {
    final accessToken = res['accessToken'] as String?;
    final guest = res['guest'] is Map
        ? Map<String, dynamic>.from(res['guest'] as Map)
        : <String, dynamic>{};
    if (accessToken == null || accessToken.isEmpty) {
      throw StateError('Sign-in failed. Please try again.');
    }
    await ref.read(authControllerProvider).setSession(
          token: accessToken,
          guestId: guest['id']?.toString() ?? '',
          phone: guest['phone']?.toString() ?? _digits,
          name: guest['name']?.toString(),
          email: guest['email']?.toString(),
          staySignedIn: _staySignedIn,
        );
    unawaited(GuestPushService.instance.registerForCurrentUser(ref));
    final requiresPin = res['requiresPinSetup'] == true;
    if (requiresPin) {
      _pendingToken = accessToken;
      _pendingGuest = guest;
      setState(() => _step = _AuthStep.pinSetup);
      return;
    }
    _goNext();
  }

  Future<void> _verifyOtp() async {
    if (!_exists && _name.text.trim().isEmpty) {
      setState(() => _error = 'Please enter your name');
      return;
    }
    if (!_otpSent || _msg91ReqId == null || _msg91ReqId!.isEmpty) {
      await _requestOtp();
      return;
    }
    final code = _code.text.trim();
    if (code.length < 4) {
      setState(() => _error = 'Enter the OTP from SMS');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(guestApiProvider).widgetConfirmOtp(
            reqId: _msg91ReqId!,
            otp: code,
            phone: _digits,
            name: _name.text.trim().isEmpty ? null : _name.text.trim(),
          );
      await _applyGuestSession(res);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _completeFirebaseCredential(AuthCredential credential) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cred =
          await FirebaseAuth.instance.signInWithCredential(credential);
      await _completeFirebaseUser(cred.user);
    } catch (e) {
      setState(() {
        _error = e is DioException
            ? friendlyAuthError(e)
            : friendlyFirebaseAuthError(e);
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _completeFirebaseUser(User? user) async {
    if (user == null) {
      throw StateError('Sign-in did not return a user. Please try again.');
    }

    final displayName = _name.text.trim();
    if (displayName.isNotEmpty &&
        (user.displayName == null || user.displayName!.isEmpty)) {
      await user.updateDisplayName(displayName);
      await user.reload();
    }

    final refreshed = FirebaseAuth.instance.currentUser ?? user;
    try {
      await ref.read(guestFirestoreServiceProvider).upsertFromUser(
            refreshed,
            displayName: displayName.isEmpty ? null : displayName,
          );
    } catch (_) {}

    final idToken = await refreshed.getIdToken(true);
    if (idToken == null || idToken.isEmpty) {
      throw StateError('Missing Firebase ID token');
    }

    final res = await ref.read(guestApiProvider).exchangeFirebase(
          idToken: idToken,
          name: displayName.isEmpty ? refreshed.displayName : displayName,
          captchaToken: _captchaToken.isEmpty ? null : _captchaToken,
        );
    final guest = Map<String, dynamic>.from(res['guest'] as Map);
    final token = res['accessToken'] as String;
    final phone = (guest['phone'] as String?) ??
        refreshed.phoneNumber?.replaceAll(RegExp(r'\D'), '') ??
        '';

    await ref.read(authControllerProvider).setSession(
          token: token,
          guestId: guest['id'] as String,
          phone: phone,
          name: guest['name'] as String?,
          email: guest['email'] as String?,
          staySignedIn: _staySignedIn,
        );
    unawaited(GuestPushService.instance.registerForCurrentUser(ref));

    final requiresPin = res['requiresPinSetup'] == true && phone.isNotEmpty;
    if (requiresPin && mounted) {
      setState(() {
        _pendingToken = token;
        _pendingGuest = guest;
        _step = _AuthStep.pinSetup;
        _error = null;
      });
      return;
    }

    _goNext();
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cred =
          await ref.read(firebaseAuthServiceProvider).signInWithGoogle();
      await _completeFirebaseUser(cred?.user);
    } catch (e) {
      setState(() {
        _error = e is DioException
            ? friendlyAuthError(e)
            : friendlyFirebaseAuthError(e);
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _signInWithEmail() async {
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = ref.read(firebaseAuthServiceProvider);
      final cred = await auth.signInWithEmail(
        email: _email.text.trim(),
        password: _password.text,
      );
      final user = cred.user;
      if (user == null) {
        throw StateError('Sign-in did not return a user.');
      }
      if (!user.emailVerified) {
        await user.sendEmailVerification();
        await FirebaseAuth.instance.signOut();
        setState(() {
          _error =
              'Verify your email first. We sent a new link to ${_email.text.trim()}. '
              'Open it, then sign in again.';
        });
        return;
      }
      await _completeFirebaseUser(user);
    } catch (e) {
      setState(() {
        _error = e is DioException
            ? friendlyAuthError(e)
            : friendlyFirebaseAuthError(e);
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _registerWithEmail() async {
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = ref.read(firebaseAuthServiceProvider);
      final cred = await auth.registerWithEmail(
        email: _email.text.trim(),
        password: _password.text,
      );
      final user = cred.user;
      if (user == null) {
        throw StateError('Could not create account.');
      }
      if (_name.text.trim().isNotEmpty) {
        await user.updateDisplayName(_name.text.trim());
      }
      await user.sendEmailVerification();
      await FirebaseAuth.instance.signOut();
      if (!mounted) return;
      setState(() {
        _step = _AuthStep.email;
        _error =
            'Account created. Check ${_email.text.trim()} for a verification link, '
            'then sign in with email & password.';
        _password.clear();
      });
    } catch (e) {
      setState(() {
        _error = e is DioException
            ? friendlyAuthError(e)
            : friendlyFirebaseAuthError(e);
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  void _handleBack() {
    setState(() => _error = null);
    switch (_step) {
      case _AuthStep.pinLogin:
      case _AuthStep.otp:
        if (_exists && _hasPin) {
          setState(() {
            _step = _AuthStep.method;
            _otpSent = false;
            _msg91ReqId = null;
            _code.clear();
          });
        } else {
          setState(() {
            _step = _AuthStep.phone;
            _verificationId = null;
            _otpSent = false;
            _msg91ReqId = null;
            _code.clear();
          });
        }
        return;
      case _AuthStep.method:
        setState(() => _step = _AuthStep.phone);
        return;
      case _AuthStep.pinSetup:
        ref.read(authControllerProvider).logout();
        context.go('/');
        return;
      case _AuthStep.email:
      case _AuthStep.emailRegister:
        setState(() => _step = _AuthStep.phone);
        return;
      case _AuthStep.phone:
        context.go('/');
        return;
    }
  }

  Future<void> _setPin() async {
    final pin = _pin.text.trim();
    final confirm = _pinConfirm.text.trim();
    if (pin != confirm) {
      setState(() => _error = 'PINs do not match');
      return;
    }
    if (!_acceptedTerms && !(_exists && _hasPin)) {
      setState(() => _error = 'Accept Privacy Policy and Terms to continue');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(guestApiProvider).setPin(
            pin: pin,
            name: _name.text.trim().isEmpty ? null : _name.text.trim(),
          );
      final guest = Map<String, dynamic>.from(res['guest'] as Map);
      await ref.read(authControllerProvider).setSession(
            token: res['accessToken'] as String? ?? _pendingToken!,
            guestId: guest['id'] as String,
            phone: guest['phone'] as String,
            name: guest['name'] as String?,
            email: guest['email'] as String?,
            staySignedIn: _staySignedIn,
          );
      unawaited(GuestPushService.instance.registerForCurrentUser(ref));
      _goNext();
    } catch (e) {
      setState(() => _error = friendlyAuthError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _loginPin() async {
    if (!_captchaOk) {
      setState(() => _error = 'Please complete the security check');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(guestApiProvider).loginWithPin(
            phone: _digits,
            pin: _pin.text.trim(),
            captchaToken: _captchaToken.isEmpty ? null : _captchaToken,
          );
      final guest = Map<String, dynamic>.from(res['guest'] as Map);
      await ref.read(authControllerProvider).setSession(
            token: res['accessToken'] as String,
            guestId: guest['id'] as String,
            phone: guest['phone'] as String,
            name: guest['name'] as String?,
            email: guest['email'] as String?,
            staySignedIn: _staySignedIn,
          );
      unawaited(GuestPushService.instance.registerForCurrentUser(ref));
      _goNext();
    } catch (e) {
      setState(() => _error = friendlyAuthError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  void _goNext() {
    if (!mounted) return;
    final raw = widget.nextPath;
    if (raw != null && raw.isNotEmpty) {
      try {
        context.go(Uri.decodeComponent(raw));
      } catch (_) {
        context.go(raw);
      }
      return;
    }
    context.go('/');
  }

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _name.dispose();
    _pin.dispose();
    _pinConfirm.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SingleChildScrollView(
          child: Stack(
            children: [
              _LoginHero(height: _heroHeight, onBack: _handleBack),
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      GuestSpacing.page,
                      _heroHeight - 44,
                      GuestSpacing.page,
                      GuestSpacing.page,
                    ),
              // ── Auth card ─────────────────────────────────────────────────
              child: Container(
                padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
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
                  children: [
                    if (_step == _AuthStep.phone) ...[
                      Text.rich(
                        TextSpan(
                          children: [
                            const TextSpan(text: 'Welcome to '),
                            TextSpan(
                              text: 'Cullinos',
                              style: TextStyle(color: GuestColors.primaryOf(context)),
                            ),
                          ],
                        ),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: GuestColors.ink,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Discover great restaurants, order your favorite food '
                        'and enjoy a seamless dining experience.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: GuestColors.muted,
                          fontSize: 13.5,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 20),
                      _GoogleButton(
                        loading: _loading,
                        onPressed: _loading ? null : _signInWithGoogle,
                      ),
                      const SizedBox(height: 12),
                      _BrandButton(
                        label: 'Continue with Email',
                        leading: Icons.mail_outline_rounded,
                        onPressed: _loading
                            ? null
                            : () => setState(() {
                                  _step = _AuthStep.email;
                                  _error = null;
                                }),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Expanded(
                            child: Divider(
                              color: GuestColors.muted.withValues(alpha: 0.3),
                            ),
                          ),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              'or continue with phone',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: GuestColors.muted),
                            ),
                          ),
                          Expanded(
                            child: Divider(
                              color: GuestColors.muted.withValues(alpha: 0.3),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      PhoneField(
                        controller: _phone,
                        textInputAction: TextInputAction.done,
                        onComposedChanged: (v) => setState(() => _composedPhone = v),
                        onSubmitted: (_) {
                          if (_phoneOk && !_loading) _continuePhone();
                        },
                      ),
                      if (TurnstileField.isEnabled) ...[
                        const SizedBox(height: 12),
                        TurnstileField(
                          onToken: (t) => setState(() => _captchaToken = t),
                          onExpire: () => setState(() => _captchaToken = ''),
                        ),
                      ],
                      const SizedBox(height: 6),
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        value: _staySignedIn,
                        onChanged: (v) =>
                            setState(() => _staySignedIn = v ?? true),
                        controlAffinity: ListTileControlAffinity.leading,
                        activeColor: GuestColors.primaryOf(context),
                        title: const Text(
                          'Stay signed in',
                          style: TextStyle(fontSize: 14, color: GuestColors.ink),
                        ),
                      ),
                      const SizedBox(height: 6),
                      _BrandButton(
                        label: 'Continue with Phone',
                        trailingArrow: true,
                        loading: _loading,
                        onPressed:
                            _phoneOk && !_loading ? _continuePhone : null,
                      ),
                      const SizedBox(height: 16),
                      _TermsLine(
                        onTerms: () => context.push('/terms'),
                        onPrivacy: () => context.push('/privacy'),
                      ),
                    ],

                    if (_step == _AuthStep.email ||
                        _step == _AuthStep.emailRegister) ...[
                      TextField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          hintText: 'you@example.com',
                          prefixIcon: Icon(Icons.email_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password,
                        obscureText: !_showPassword,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _showPassword ? 'Hide password' : 'Show password',
                            onPressed: () =>
                                setState(() => _showPassword = !_showPassword),
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
                      const SizedBox(height: 12),
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _staySignedIn,
                        onChanged: (v) =>
                            setState(() => _staySignedIn = v ?? true),
                        controlAffinity: ListTileControlAffinity.leading,
                        activeColor: GuestColors.primary,
                        title: Text(
                          'Stay signed in',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      GuestPillButton(
                        label: _step == _AuthStep.emailRegister
                            ? 'Create account'
                            : 'Sign in',
                        loading: _loading,
                        onPressed: _loading
                            ? null
                            : (_step == _AuthStep.emailRegister
                                ? _registerWithEmail
                                : _signInWithEmail),
                      ),
                      TextButton(
                        onPressed: () => setState(() {
                          _step = _step == _AuthStep.email
                              ? _AuthStep.emailRegister
                              : _AuthStep.email;
                          _error = null;
                        }),
                        style: TextButton.styleFrom(
                          foregroundColor: GuestColors.primary,
                        ),
                        child: Text(
                          _step == _AuthStep.email
                              ? 'New here? Create an account'
                              : 'Already have an account? Sign in',
                        ),
                      ),
                    ],

                    if (_step == _AuthStep.method) ...[
                      Text(
                        _displayPhone,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Choose how to sign in',
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: GuestColors.muted),
                      ),
                      const SizedBox(height: 16),
                      GuestPillButton(
                        label: 'Sign in with PIN',
                        icon: Icons.pin_outlined,
                        onPressed: () =>
                            setState(() => _step = _AuthStep.pinLogin),
                      ),
                      const SizedBox(height: 10),
                      GuestPillButton(
                        label: 'Sign in with OTP',
                        secondary: true,
                        onPressed: _loading ? null : () => _requestOtp(),
                      ),
                      TextButton(
                        onPressed: () => setState(() {
                          _step = _AuthStep.phone;
                          _error = null;
                        }),
                        style: TextButton.styleFrom(
                          foregroundColor: GuestColors.primary,
                        ),
                        child: const Text('Change number'),
                      ),
                    ],

                    if (_step == _AuthStep.otp) ...[
                      Text(
                        _displayPhone,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _otpSent
                            ? 'Enter the 6-digit code sent by SMS'
                            : 'We will send an SMS OTP to this number',
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: GuestColors.muted),
                      ),
                      if (!_exists) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Your name',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                        ),
                      ],
                      if (_otpSent) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: _code,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          decoration: const InputDecoration(
                            labelText: 'OTP',
                            counterText: '',
                            helperText: 'Enter the code from your SMS',
                            prefixIcon: Icon(Icons.sms_outlined),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      GuestPillButton(
                        label: _otpSent ? 'Verify & continue' : 'Send OTP',
                        loading: _loading,
                        onPressed: _loading ? null : _verifyOtp,
                      ),
                      if (_otpSent)
                        TextButton(
                          onPressed: _loading
                              ? null
                              : () => _requestOtp(resend: true),
                          style: TextButton.styleFrom(
                            foregroundColor: GuestColors.primary,
                          ),
                          child: const Text('Resend OTP'),
                        ),
                    ],

                    if (_step == _AuthStep.pinSetup) ...[
                      Text(
                        'Create a login PIN',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "4–6 digits. You'll use this next time.",
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: GuestColors.muted),
                      ),
                      if (_name.text.isEmpty &&
                          (_pendingGuest?['name'] == null)) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Your name',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pin,
                        obscureText: !_showPin,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          labelText: 'PIN',
                          counterText: '',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _showPin ? 'Hide PIN' : 'Show PIN',
                            onPressed: () =>
                                setState(() => _showPin = !_showPin),
                            icon: Icon(
                              _showPin
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _pinConfirm,
                        obscureText: !_showPinConfirm,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          labelText: 'Confirm PIN',
                          counterText: '',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _showPinConfirm ? 'Hide PIN' : 'Show PIN',
                            onPressed: () => setState(
                              () => _showPinConfirm = !_showPinConfirm,
                            ),
                            icon: Icon(
                              _showPinConfirm
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _acceptedTerms,
                        onChanged: (v) =>
                            setState(() => _acceptedTerms = v ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        activeColor: GuestColors.primary,
                        title: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            const Text('I agree to the '),
                            GestureDetector(
                              onTap: () => context.push('/privacy'),
                              child: const Text(
                                'Privacy Policy',
                                style: TextStyle(
                                  color: GuestColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const Text(' and '),
                            GestureDetector(
                              onTap: () => context.push('/terms'),
                              child: const Text(
                                'Terms',
                                style: TextStyle(
                                  color: GuestColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      GuestPillButton(
                        label: 'Save PIN & continue',
                        loading: _loading,
                        onPressed: _loading ? null : _setPin,
                      ),
                    ],

                    if (_step == _AuthStep.pinLogin) ...[
                      Text(
                        _displayPhone,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pin,
                        obscureText: !_showPin,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          labelText: 'PIN',
                          counterText: '',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _showPin ? 'Hide PIN' : 'Show PIN',
                            onPressed: () =>
                                setState(() => _showPin = !_showPin),
                            icon: Icon(
                              _showPin
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
                      const SizedBox(height: 16),
                      GuestPillButton(
                        label: 'Sign in',
                        loading: _loading,
                        onPressed: _loading ? null : _loginPin,
                      ),
                      TextButton(
                        onPressed: () => setState(() {
                          _step = _AuthStep.method;
                          _error = null;
                        }),
                        style: TextButton.styleFrom(
                          foregroundColor: GuestColors.primary,
                        ),
                        child: const Text('Other options'),
                      ),
                    ],

                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .errorContainer
                              .withValues(alpha: 0.3),
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusSm),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.error_outline,
                              size: 16,
                              color: Theme.of(context).colorScheme.error,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                  height: 1.35,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LoginHero extends StatefulWidget {
  const _LoginHero({required this.height, required this.onBack});

  final double height;
  final VoidCallback onBack;

  @override
  State<_LoginHero> createState() => _LoginHeroState();
}

class _LoginHeroState extends State<_LoginHero> {
  static const _features = [
    (Icons.restaurant_menu_rounded, 'Discover'),
    (Icons.shopping_bag_outlined, 'Order'),
    (Icons.groups_outlined, 'Dine In'),
  ];

  int _active = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) setState(() => _active = (_active + 1) % _features.length);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final primary = GuestColors.primaryOf(context);
    return SizedBox(
      height: widget.height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'assets/images/login_hero.jpg',
            fit: BoxFit.cover,
            alignment: Alignment.centerRight,
            errorBuilder: (_, __, ___) =>
                const DecoratedBox(decoration: BoxDecoration(gradient: GuestColors.heroTeal)),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  Colors.white.withValues(alpha: 0.94),
                  Colors.white.withValues(alpha: 0.6),
                  Colors.white.withValues(alpha: 0.0),
                ],
                stops: const [0.0, 0.48, 0.8],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(20, top + 6, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconButton(
                  tooltip: 'Back',
                  onPressed: widget.onBack,
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.85),
                  ),
                  icon: Icon(Icons.arrow_back_rounded, color: primary, size: 20),
                ),
                const SizedBox(height: 4),
                Text(
                  'Cullinos',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 40,
                    height: 1.0,
                    fontWeight: FontWeight.w800,
                    color: GuestColors.primaryDeepOf(context),
                    letterSpacing: -1.2,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Good Food Brings\nPeople Together.',
                  style: TextStyle(
                    fontSize: 16,
                    height: 1.3,
                    color: GuestColors.ink,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (var i = 0; i < _features.length; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _features[i].$1,
                                size: 22,
                                color: i == _active ? primary : GuestColors.ink,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _features[i].$2,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: i == _active ? FontWeight.w700 : FontWeight.w500,
                                  color: i == _active ? primary : GuestColors.ink,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    for (var i = 0; i < _features.length; i++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.only(right: 6),
                        width: i == _active ? 30 : 22,
                        height: 5,
                        decoration: BoxDecoration(
                          color: i == _active ? primary : GuestColors.border,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.loading, required this.onPressed});

  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white,
          side: const BorderSide(color: GuestColors.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(4),
                    child: Image.asset(
                      'assets/images/google_g.png',
                      width: 20,
                      height: 20,
                      filterQuality: FilterQuality.high,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Continue with Google',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: GuestColors.ink,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _BrandButton extends StatelessWidget {
  const _BrandButton({
    required this.label,
    required this.onPressed,
    this.leading,
    this.trailingArrow = false,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? leading;
  final bool trailingArrow;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final bg = GuestColors.primaryOf(context);
    return SizedBox(
      height: 56,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: bg,
          disabledBackgroundColor: bg.withValues(alpha: 0.45),
          disabledForegroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(trailingArrow ? 28 : 16),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 10),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 40,
              child: leading != null ? Icon(leading, color: Colors.white, size: 22) : null,
            ),
            Expanded(
              child: Center(
                child: loading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                      )
                    : Text(
                        label,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
            SizedBox(
              width: 40,
              height: 40,
              child: trailingArrow
                  ? DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.arrow_forward_rounded,
                          color: Colors.white, size: 20),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _TermsLine extends StatelessWidget {
  const _TermsLine({required this.onTerms, required this.onPrivacy});

  final VoidCallback onTerms;
  final VoidCallback onPrivacy;

  @override
  Widget build(BuildContext context) {
    final link = TextStyle(
      color: GuestColors.primaryOf(context),
      fontWeight: FontWeight.w600,
      decoration: TextDecoration.underline,
    );
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        const Text(
          'By continuing, you agree to our ',
          style: TextStyle(fontSize: 12, color: GuestColors.muted),
        ),
        GestureDetector(
          onTap: onTerms,
          child: Text('Terms of Service', style: link.copyWith(fontSize: 12)),
        ),
        const Text(' and ', style: TextStyle(fontSize: 12, color: GuestColors.muted)),
        GestureDetector(
          onTap: onPrivacy,
          child: Text('Privacy Policy', style: link.copyWith(fontSize: 12)),
        ),
      ],
    );
  }
}

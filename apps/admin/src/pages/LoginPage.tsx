import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { defaultPortalMode } from '@cullinos/shared';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LanguageSelect } from '@/components/LanguageSelect';
import { Button, Input, PasswordInput, Turnstile, isTurnstileEnabled } from '@cullinos/ui';
import { authApi } from '@/lib/api';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';
import { useAuthStore, ADMIN_REMEMBER_KEY } from '@/stores/auth';

function postLoginPath(permissions: string[], mustChangePassword?: boolean) {
  if (mustChangePassword) return '/change-password';
  return defaultPortalMode(permissions) === 'pos' ? '/pos' : '/';
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [remember, setRemember] = useState(
    () => localStorage.getItem(ADMIN_REMEMBER_KEY) === 'true',
  );
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);

  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResendMessage('');
    if (turnstileOn && !captchaToken) {
      setError(t('auth.completeSecurityCheck'));
      return;
    }
    setLoading(true);
    localStorage.setItem(ADMIN_REMEMBER_KEY, remember ? 'true' : 'false');

    try {
      const response = await authApi.login({
        email,
        password,
        captchaToken: captchaToken || undefined,
      });
      if ('requiresOtp' in response) {
        setChallengeToken(response.challengeToken);
        return;
      }
      setAuth(response);
      navigate(postLoginPath(response.permissions, response.user.mustChangePassword));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
      setCaptchaToken('');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError('');
    setLoading(true);
    try {
      const response = await authApi.verifyOtp({ challengeToken, otp });
      setAuth(response);
      navigate(postLoginPath(response.permissions, response.user.mustChangePassword));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.verificationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!challengeToken) return;
    setError('');
    setResendMessage('');
    setLoading(true);
    try {
      const response = await authApi.resendOtp({ challengeToken });
      setChallengeToken(response.challengeToken);
      setResendMessage(t('auth.codeResent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resendFailed'));
    } finally {
      setLoading(false);
    }
  }

  const languagePicker = (
    <div className="mb-4 flex justify-end">
      <LanguageSelect />
    </div>
  );

  if (challengeToken) {
    return (
      <AuthLayout title={t('auth.checkEmail')} subtitle={t('auth.otpSubtitle')}>
        {languagePicker}
        <form onSubmit={handleOtpSubmit} className="space-y-5">
          {error ? (
            <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          ) : null}
          {resendMessage ? (
            <div className="rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-secondary">
              {resendMessage}
            </div>
          ) : null}

          <Input
            label={t('auth.verificationCode')}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />

          <Button type="submit" className="w-full" loading={loading}>
            {t('auth.verifyAndSignIn')}
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="w-full text-sm text-brand-primary hover:underline disabled:opacity-60"
          >
            {t('auth.resendCode')}
          </button>

          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setOtp('');
              setError('');
              setResendMessage('');
            }}
            className="w-full text-sm text-text-secondary hover:underline"
          >
            {t('auth.backToSignIn')}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.welcomeBack')} subtitle={t('auth.signInSubtitle')}>
      {languagePicker}
      <form onSubmit={handlePasswordSubmit} className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        <Input
          label={t('common.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordInput
          label={t('auth.password')}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {turnstileOn ? (
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onToken={onCaptchaToken}
            onExpire={onCaptchaExpire}
          />
        ) : null}

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-brand-primary hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-primary"
          />
          {t('auth.keepSignedIn')}
        </label>

        <Button type="submit" className="w-full" loading={loading}>
          {t('auth.signIn')}
        </Button>

        <p className="text-center text-sm text-text-secondary">
          {t('auth.newRestaurant')}{' '}
          <Link to="/register" className="text-brand-primary hover:underline">
            {t('auth.startTrial')}
          </Link>
        </p>
      </form>

      <p className="mt-6 rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-center text-sm text-text-secondary">
        {t('auth.ownerNote')}
      </p>
    </AuthLayout>
  );
}

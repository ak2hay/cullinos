import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { defaultPortalMode } from '@cullinos/shared';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input, PasswordInput, Turnstile, isTurnstileEnabled } from '@cullinos/ui';
import { authApi } from '@/lib/api';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';
import { useAuthStore, ADMIN_REMEMBER_KEY } from '@/stores/auth';

function postLoginPath(permissions: string[], mustChangePassword?: boolean) {
  if (mustChangePassword) return '/change-password';
  return defaultPortalMode(permissions) === 'pos' ? '/pos' : '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [remember, setRemember] = useState(true);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);

  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResendMessage('');
    if (turnstileOn && !captchaToken) {
      setError('Please complete the security check');
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
      setError(err instanceof Error ? err.message : 'Login failed');
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
      setError(err instanceof Error ? err.message : 'Verification failed');
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
      setResendMessage('A new code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  }

  if (challengeToken) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="Enter the 6-digit verification code we sent you"
      >
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
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />

          <Button type="submit" className="w-full" loading={loading}>
            Verify and sign in
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="w-full text-sm text-brand-primary hover:underline disabled:opacity-60"
          >
            Resend code
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
            Back to sign in
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to manage your restaurant">
      <form onSubmit={handlePasswordSubmit} className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordInput
          label="Password"
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
            Forgot password?
          </Link>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-primary"
          />
          Keep me signed in
        </label>

        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>

        <p className="text-center text-sm text-text-secondary">
          New restaurant?{' '}
          <Link to="/register" className="text-brand-primary hover:underline">
            Start free Enterprise trial
          </Link>
        </p>
      </form>

      <p className="mt-6 rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-center text-sm text-text-secondary">
        Owner credentials are issued when your restaurant is onboarded. Use Admin to create staff
        accounts for your team — contact Rkyves if you need owner access.
      </p>
    </AuthLayout>
  );
}

import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input, PasswordInput, Turnstile, isTurnstileEnabled } from '@cullinos/ui';
import { authApi, outletsApi, type AuthResponse } from '@/lib/api';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';
import { useAuthStore, KDS_REMEMBER_KEY } from '@/stores/auth';

function resolveOutletIdFromLocation(
  search: string,
  state: unknown,
  outlets: Array<{ id: string; isActive: boolean }>,
): string | null {
  const fromUrl = new URLSearchParams(search).get('outletId')?.trim();
  if (fromUrl && outlets.some((o) => o.id === fromUrl)) {
    return fromUrl;
  }

  const fromState =
    state &&
    typeof state === 'object' &&
    'from' in state &&
    (state as { from?: { search?: string } }).from?.search
      ? new URLSearchParams((state as { from: { search: string } }).from.search)
          .get('outletId')
          ?.trim()
      : null;
  if (fromState && outlets.some((o) => o.id === fromState)) {
    return fromState;
  }

  return outlets.find((o) => o.isActive)?.id ?? null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);
  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  async function finishLogin(response: AuthResponse) {
    setAuth(response);

    const outlets = await outletsApi.list();
    const preferred = resolveOutletIdFromLocation(location.search, location.state, outlets);
    if (preferred) {
      setSelectedOutlet(preferred);
    }

    const nextSearch = preferred
      ? `?outletId=${encodeURIComponent(preferred)}`
      : location.search || '';
    navigate(`/${nextSearch}`);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResendMessage('');
    if (turnstileOn && !captchaToken) {
      setError('Please complete the security check');
      return;
    }
    setLoading(true);
    localStorage.setItem(KDS_REMEMBER_KEY, remember ? 'true' : 'false');

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
      await finishLogin(response);
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
      await finishLogin(response);
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
            Verify and open KDS
          </Button>

          <button
            type="button"
            onClick={() => void handleResend()}
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
    <AuthLayout title="Kitchen login" subtitle="Sign in to open the kitchen display">
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

        <Button type="submit" className="w-full" loading={loading}>
          Open KDS
        </Button>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-primary"
          />
          Keep me signed in
        </label>
      </form>
    </AuthLayout>
  );
}

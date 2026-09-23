import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, PasswordInput, Turnstile, isTurnstileEnabled } from '@cullinos/ui';
import { superAdminApi, RKYVES_BRAND } from '@/lib/api';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';
import { useAuthStore, SUPER_ADMIN_REMEMBER_KEY } from '@/stores/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);
  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    if (turnstileOn && !captchaToken) {
      setError('Please complete the security check');
      return;
    }
    setLoading(true);
    localStorage.setItem(SUPER_ADMIN_REMEMBER_KEY, remember ? 'true' : 'false');
    try {
      const response = await superAdminApi.login({
        email,
        password,
        captchaToken: captchaToken || undefined,
      });
      if ('requiresOtp' in response) {
        setChallengeToken(response.challengeToken);
        return;
      }
      setAuth({ accessToken: response.accessToken, admin: response.admin });
      navigate('/');
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
    setError(null);
    setLoading(true);
    try {
      const response = await superAdminApi.verifyOtp({ challengeToken, otp });
      setAuth({ accessToken: response.accessToken, admin: response.admin });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!challengeToken) return;
    setError(null);
    setResendMessage(null);
    setLoading(true);
    try {
      const response = await superAdminApi.resendOtp({ challengeToken });
      setChallengeToken(response.challengeToken);
      setResendMessage('A new code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg-secondary p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary font-mono text-lg font-bold text-bg-primary">
            R
          </div>
          <h1 className="text-2xl font-semibold">{RKYVES_BRAND.name} Platform Admin</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {challengeToken
              ? 'Enter the verification code sent to your email.'
              : `Super-admin access for ${RKYVES_BRAND.product} tenant management.`}
          </p>
        </div>

        {challengeToken ? (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <Input
              label="Verification code"
              type="text"
              inputMode="numeric"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />

            {error ? (
              <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
                {error}
              </p>
            ) : null}
            {resendMessage ? (
              <p className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
                {resendMessage}
              </p>
            ) : null}

            <Button type="submit" loading={loading} className="w-full">
              Verify and sign in
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={handleResend}
              className="w-full"
            >
              Resend code
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setChallengeToken(null);
                setOtp('');
                setError(null);
                setResendMessage(null);
              }}
              className="w-full"
            >
              Back to sign in
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordInput
              label="Password"
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

            {error ? (
              <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
                {error}
              </p>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded accent-brand-primary"
              />
              Keep me signed in
            </label>

            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

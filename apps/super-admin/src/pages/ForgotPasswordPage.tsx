import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordInput, Turnstile, isTurnstileEnabled } from '@cullinos/ui';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { RKYVES_BRAND, superAdminApi } from '@/lib/api';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';

type Step = 'email' | 'reset';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);
  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (turnstileOn && !captchaToken) {
      setError('Complete the security check');
      return;
    }
    setLoading(true);
    try {
      await superAdminApi.forgotPassword({ email, captchaToken: captchaToken || undefined });
      setMessage('If an account exists for that email, a reset code has been sent.');
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setCaptchaToken('');
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await superAdminApi.resetPassword({ email, otp, newPassword });
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={step === 'email' ? 'Forgot password' : 'Reset password'}
      subtitle={
        step === 'email'
          ? `Reset access for ${RKYVES_BRAND.name} platform admin.`
          : 'Enter the email code and your new password.'
      }
    >

        {step === 'email' ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <label className="block">
              <span className="text-sm text-text-secondary">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-line bg-bg-card px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            {turnstileOn ? (
              <Turnstile
                key={captchaKey}
                siteKey={TURNSTILE_SITE_KEY}
                onToken={onCaptchaToken}
                onExpire={onCaptchaExpire}
              />
            ) : null}
            {error ? (
              <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-brand-primary text-sm font-semibold text-on-brand hover:bg-brand-primary-dark disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
            <p className="text-center text-sm text-text-secondary">
              <Link to="/login" className="text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {message ? (
              <p className="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
                {error}
              </p>
            ) : null}
            <label className="block">
              <span className="text-sm text-text-secondary">Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1 h-11 w-full rounded-lg border border-line bg-bg-card px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <PasswordInput
              label="New password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirm password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-brand-primary text-sm font-semibold text-on-brand hover:bg-brand-primary-dark disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
            <p className="text-center text-sm text-text-secondary">
              <Link to="/login" className="text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
    </AuthLayout>
  );
}

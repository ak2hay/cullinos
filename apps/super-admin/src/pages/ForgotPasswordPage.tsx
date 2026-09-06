import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RKYVES_BRAND, superAdminApi } from '@/lib/api';

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

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await superAdminApi.forgotPassword({ email });
      setMessage('If an account exists for that email, a reset code has been sent.');
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
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
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg-secondary p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary font-mono text-lg font-bold">
            R
          </div>
          <h1 className="text-2xl font-semibold">
            {step === 'email' ? 'Forgot password' : 'Reset password'}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {step === 'email'
              ? `Reset access for ${RKYVES_BRAND.name} platform admin.`
              : 'Enter the email code and your new password.'}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <label className="block">
              <span className="text-sm text-text-secondary">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-primary py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
            <p className="text-center text-sm text-text-secondary">
              <Link to="/login" className="text-brand-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {message ? (
              <p className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
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
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">New password</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">Confirm password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-primary py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
            <p className="text-center text-sm text-text-secondary">
              <Link to="/login" className="text-brand-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

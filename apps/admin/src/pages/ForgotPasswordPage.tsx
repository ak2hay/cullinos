import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@cullinos/ui';
import { authApi } from '@/lib/api';

type Step = 'email' | 'reset';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
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
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, otp, newPassword });
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'reset') {
    return (
      <AuthLayout
        title="Reset password"
        subtitle="Enter the code from your email and choose a new password"
      >
        <form onSubmit={handleReset} className="space-y-5">
          {message ? (
            <div className="rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-secondary">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          ) : null}

          <Input
            label="Verification code"
            inputMode="numeric"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" loading={loading}>
            Update password
          </Button>

          <p className="text-center text-sm text-text-secondary">
            <Link to="/login" className="text-brand-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a code to reset your password"
    >
      <form onSubmit={handleRequestCode} className="space-y-5">
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

        <Button type="submit" className="w-full" loading={loading}>
          Send reset code
        </Button>

        <p className="text-center text-sm text-text-secondary">
          <Link to="/login" className="text-brand-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

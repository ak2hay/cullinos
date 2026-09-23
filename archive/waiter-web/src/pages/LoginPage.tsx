import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@cullinos/ui';
import { authApi, outletsApi } from '@/lib/api';
import { useAuthStore, WAITER_REMEMBER_KEY } from '@/stores/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [remember, setRemember] = useState(true);

  async function completeLogin(response: Awaited<ReturnType<typeof authApi.verifyOtp>>) {
    setAuth({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: {
        id: response.user.id,
        organizationId: response.user.organizationId,
        email: response.user.email,
        firstName: response.user.firstName,
        lastName: response.user.lastName,
        phone: response.user.phone,
        avatarUrl: response.user.avatarUrl,
        isActive: response.user.isActive,
        lastLoginAt: response.user.lastLoginAt,
        createdAt: response.user.createdAt,
      },
      permissions: response.permissions,
    });

    const outlets = await outletsApi.list();
    const active = outlets.find((o) => o.isActive);
    if (active) {
      setSelectedOutlet(active.id);
    }

    navigate('/');
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResendMessage('');
    setLoading(true);
    localStorage.setItem(WAITER_REMEMBER_KEY, remember ? 'true' : 'false');

    try {
      const response = await authApi.login({ email, password });
      if ('requiresOtp' in response) {
        setChallengeToken(response.challengeToken);
        return;
      }
      await completeLogin(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
      await completeLogin(response);
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
    <AuthLayout title="Waiter login" subtitle="Sign in to manage tables and orders">
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

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" className="w-full" loading={loading}>
          Sign in
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

      <p className="mt-6 rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-center text-sm text-text-secondary">
        Staff credentials are created by your restaurant owner in Admin. Contact your manager if
        you need access.
      </p>
    </AuthLayout>
  );
}

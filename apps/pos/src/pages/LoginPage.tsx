import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PasswordInput, Turnstile, isTurnstileEnabled } from '@cullinos/ui';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';
import { useAuthStore, POS_REMEMBER_KEY } from '@/stores/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(
    () => localStorage.getItem(POS_REMEMBER_KEY) === 'true',
  );
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);
  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (turnstileOn && !captchaToken) {
      setError('Please complete the security check');
      return;
    }
    setLoading(true);
    localStorage.setItem(POS_REMEMBER_KEY, remember ? 'true' : 'false');

    try {
      const response = await authApi.login({
        email,
        password,
        captchaToken: captchaToken || undefined,
      });
      setAuth(response);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setCaptchaToken('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Cashier sign in</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Enter your credentials to open the register
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
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
          className="h-14 rounded-xl px-4 text-lg"
        />

        <PasswordInput
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 rounded-xl px-4 text-lg"
        />

        {turnstileOn ? (
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onToken={onCaptchaToken}
            onExpire={onCaptchaExpire}
          />
        ) : null}

        <Button type="submit" size="lg" loading={loading} className="w-full rounded-xl text-lg">
          Open register
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

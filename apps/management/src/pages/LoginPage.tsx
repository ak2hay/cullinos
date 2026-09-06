import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      setAuth({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
        permissions: response.permissions,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg-secondary p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary font-mono text-xl font-bold text-bg-primary">
            M
          </div>
          <h1 className="text-2xl font-semibold">Management Console</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to manage outlets, reports, and franchise operations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? (
            <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Sign in with credentials issued to your organization owner. Additional manager
          accounts can be created by the owner in Admin → Staff.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@cullinos/ui';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      setAuth(response);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 rounded-xl px-4 text-lg"
        />

        <Button type="submit" size="lg" loading={loading} className="w-full rounded-xl text-lg">
          Open register
        </Button>
      </form>
    </AuthLayout>
  );
}

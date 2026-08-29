import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@/components/ui/Form';
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
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your restaurant"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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
      </form>

        <p className="mt-6 rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-center text-sm text-text-secondary">
        Owner credentials are issued when your restaurant is onboarded. Use Admin to create
        staff accounts for your team — contact Rkyves if you need owner access.
      </p>
    </AuthLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthFooterLink, AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@/components/ui/Form';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    organizationName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.register({
        organizationName: form.organizationName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      });
      setAuth(response);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Get started"
      subtitle="Create your organization and owner account"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        <Input
          label="Restaurant / Organization name"
          required
          value={form.organizationName}
          onChange={(e) => updateField('organizationName', e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            required
            value={form.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
          />
          <Input
            label="Last name"
            required
            value={form.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
          />
        </div>

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
        />

        <Input
          label="Phone (optional)"
          type="tel"
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => updateField('password', e.target.value)}
        />

        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <AuthFooterLink
        text="Already have an account?"
        linkText="Sign in"
        to="/login"
      />
    </AuthLayout>
  );
}

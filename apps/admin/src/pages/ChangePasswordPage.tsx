import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultPortalMode } from '@cullinos/shared';
import { Button, Input, PasswordInput } from '@cullinos/ui';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword);
  const permissions = useAuthStore((s) => s.permissions);
  const impersonation = useAuthStore((s) => s.impersonation);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (impersonation) {
    return (
      <AuthLayout title="Password change blocked" subtitle="Support sessions cannot change passwords.">
        <Button type="button" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </AuthLayout>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setMustChangePassword(false);
      navigate(defaultPortalMode(permissions) === 'pos' ? '/pos' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Change password" subtitle="You must set a new password before continuing">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}
        <PasswordInput
          label="Current temporary password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" loading={loading}>
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}

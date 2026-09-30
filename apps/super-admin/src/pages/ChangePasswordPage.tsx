import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PasswordInput } from '@cullinos/ui';
import { RKYVES_BRAND, superAdminApi } from '@/lib/api';
import type { PlatformRole } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const admin = useAuthStore((s) => s.admin);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await superAdminApi.changePassword({ currentPassword, newPassword });
      setAuth({
        accessToken: res.accessToken ?? res.token,
        admin: {
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          avatarUrl: admin?.avatarUrl ?? null,
          platformRole: res.user.platformRole as PlatformRole | undefined,
          platformPermissions: res.user.platformPermissions ?? admin?.platformPermissions ?? [],
          mustChangePassword: false,
        },
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-bg-secondary p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">{RKYVES_BRAND.name} Platform Admin</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {admin?.mustChangePassword
              ? 'Set a new password before you continue.'
              : 'Change your password.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Current (temporary) password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <PasswordInput
            label="New password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordInput
            label="Confirm new password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error ? (
            <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={loading} className="w-full">
            Update password
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

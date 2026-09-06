import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { decodeJwtPayload, useAuthStore } from '@/stores/auth';

/**
 * Consumes ?impersonationToken= from super-admin support handoff.
 */
export function ImpersonationHandoff() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('impersonationToken');
    if (!token) return;

    const payload = decodeJwtPayload(token);
    if (!payload?.sub || !payload.organizationId || !payload.impersonation) {
      setError('Invalid or expired support session token.');
      const next = new URLSearchParams(params);
      next.delete('impersonationToken');
      setParams(next, { replace: true });
      return;
    }

    const permissions = Array.isArray(payload.permissions)
      ? (payload.permissions as string[])
      : [];

    setAuth({
      accessToken: token,
      refreshToken: '',
      permissions,
      impersonation: true,
      impersonatedBy: typeof payload.impersonatedBy === 'string' ? payload.impersonatedBy : null,
      user: {
        id: String(payload.sub),
        organizationId: String(payload.organizationId),
        email: String(payload.email ?? ''),
        firstName: 'Support',
        lastName: 'Session',
        phone: null,
        avatarUrl: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        mustChangePassword: false,
      },
    });

    const next = new URLSearchParams(params);
    next.delete('impersonationToken');
    setParams(next, { replace: true });
    navigate('/', { replace: true });
  }, [params, setParams, setAuth, navigate]);

  if (!error) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-status-error px-4 py-2 text-center text-sm text-white">
      {error}
    </div>
  );
}

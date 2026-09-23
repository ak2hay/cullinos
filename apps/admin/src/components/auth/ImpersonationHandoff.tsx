import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { decodeJwtPayload, useAuthStore } from '@/stores/auth';

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : '/api/v1');

/**
 * Consumes ?impersonationCode= (opaque handoff) — JWT is never placed in the URL.
 * Legacy ?impersonationToken= is still accepted once, then cleared.
 */
export function ImpersonationHandoff() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('impersonationCode');
    const legacyToken = params.get('impersonationToken');

    if (code) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/public/impersonation/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            accessToken?: string;
            message?: string;
          };
          if (!res.ok || !body.accessToken) {
            throw new Error(body.message || 'Invalid or expired support handoff');
          }
          if (cancelled) return;
          applyToken(body.accessToken);
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Support handoff failed');
          const next = new URLSearchParams(params);
          next.delete('impersonationCode');
          setParams(next, { replace: true });
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (legacyToken) {
      applyToken(legacyToken);
      const next = new URLSearchParams(params);
      next.delete('impersonationToken');
      setParams(next, { replace: true });
    }

    function applyToken(token: string) {
      const payload = decodeJwtPayload(token);
      if (!payload?.sub || !payload.organizationId || !payload.impersonation) {
        setError('Invalid or expired support session token.');
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
        impersonatedBy:
          typeof payload.impersonatedBy === 'string' ? payload.impersonatedBy : null,
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
      next.delete('impersonationCode');
      next.delete('impersonationToken');
      setParams(next, { replace: true });
      navigate('/', { replace: true });
    }
  }, [params, setParams, setAuth, navigate]);

  if (!error) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-status-error px-4 py-2 text-center text-sm text-white">
      {error}
    </div>
  );
}

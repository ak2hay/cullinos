import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError, organizationsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const impersonation = useAuthStore((s) => s.impersonation);
  const mustChangePassword =
    useAuthStore((s) => s.user?.mustChangePassword === true) && !impersonation;
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();

  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
    enabled: Boolean(accessToken) && !mustChangePassword,
    staleTime: 60_000,
    retry: 1,
  });

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const onChangePassword = location.pathname === '/change-password';
  if (mustChangePassword && !onChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (!mustChangePassword && onChangePassword) {
    return <Navigate to="/" replace />;
  }
  if (mustChangePassword && onChangePassword) {
    return children;
  }

  if (orgQuery.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-primary text-sm text-text-secondary">
        <p>Loading…</p>
      </div>
    );
  }

  if (orgQuery.error) {
    const status =
      orgQuery.error instanceof ApiRequestError ? orgQuery.error.status : 0;
    if (status === 401 || status === 403) {
      logout();
      return <Navigate to="/login" replace />;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary px-4 text-center">
        <p className="text-sm text-text-secondary">
          Could not load your organization.
          {orgQuery.error instanceof Error ? ` ${orgQuery.error.message}` : ''}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-primary hover:bg-white/5"
            onClick={() => orgQuery.refetch()}
          >
            Retry
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-secondary hover:bg-white/5"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const needsSetup = orgQuery.data?.setupCompleted !== true;
  const onOnboarding = location.pathname === '/onboarding';
  if (needsSetup && !onOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  const needsBilling =
    orgQuery.data?.trialExpired === true ||
    (orgQuery.data?.subscriptionActive === false &&
      orgQuery.data?.subscriptionStatus != null);
  const onBilling = location.pathname === '/billing';
  if (needsBilling && !onBilling && !onOnboarding) {
    return <Navigate to="/billing" replace />;
  }

  return children;
}

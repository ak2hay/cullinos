import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { refreshSession } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const refreshing = useRef(false);
  const needsRoleRefresh = Boolean(accessToken && !admin?.platformPermissions);

  useEffect(() => {
    // Sessions stored before platform roles existed carry no permissions.
    if (!needsRoleRefresh || refreshing.current) return;
    refreshing.current = true;
    void refreshSession().then((ok) => {
      refreshing.current = false;
      if (!ok) logout();
    });
  }, [needsRoleRefresh, logout]);

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (needsRoleRefresh) {
    return <p className="p-6 text-sm text-text-secondary">Loading your access…</p>;
  }

  if (admin?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

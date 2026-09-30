import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasAppOpsAccess } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const denied = Boolean(admin?.platformPermissions) && !hasAppOpsAccess(admin?.platformPermissions);

  useEffect(() => {
    if (accessToken && denied) logout();
  }, [accessToken, denied, logout]);

  if (!accessToken || denied) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

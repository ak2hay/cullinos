import { Navigate, useLocation } from 'react-router-dom';
import { hasAnyPermission, hasPermission, type Permission } from '@cullinos/shared';
import { useAuthStore } from '@/stores/auth';

export function PermissionRoute({
  children,
  allOf,
  anyOf,
  fallback = '/',
}: {
  children: React.ReactNode;
  allOf?: Permission[];
  anyOf?: Permission[];
  fallback?: string;
}) {
  const permissions = useAuthStore((s) => s.permissions);
  const location = useLocation();
  const allowed =
    (allOf?.length ? allOf.every((p) => hasPermission(permissions, p)) : true) &&
    (anyOf?.length ? hasAnyPermission(permissions, anyOf) : true);

  if (!allowed) {
    return <Navigate to={fallback} state={{ from: location }} replace />;
  }

  return children;
}

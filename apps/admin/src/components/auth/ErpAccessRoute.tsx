import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import {
  BUSINESS_TYPES,
  canAccessPortalMode,
  isErpNavPathAllowed,
  isQsrPortalOrg,
  type BusinessType,
} from '@cullinos/shared';
import { organizationsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

/**
 * Blocks cashiers (and other POS-only roles) from ERP routes in QSR orgs.
 * Also enforces ERP_NAV_PERMISSION_MAP for deep links.
 */
export function ErpAccessRoute({ children }: { children: React.ReactNode }) {
  const permissions = useAuthStore((s) => s.permissions);
  const location = useLocation();
  const { data: org, isLoading, isError } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-text-secondary">
        Loading…
      </div>
    );
  }

  if (isError) {
    return children;
  }

  const businessType: BusinessType | null =
    org?.businessType && (BUSINESS_TYPES as readonly string[]).includes(org.businessType)
      ? (org.businessType as BusinessType)
      : null;

  if (isQsrPortalOrg(businessType) && !canAccessPortalMode(permissions, 'erp')) {
    return <Navigate to="/pos" replace />;
  }

  const path = location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1] ?? ''}`;
  if (!isErpNavPathAllowed(permissions, path === '//' ? '/' : path)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

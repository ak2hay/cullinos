import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BUSINESS_TYPES,
  isAdminNavPathVisible,
  type BusinessType,
} from '@cullinos/shared';
import { organizationsApi } from '@/lib/api';

function parseBusinessType(value: string | null | undefined): BusinessType | null {
  if (!value) return null;
  return (BUSINESS_TYPES as readonly string[]).includes(value)
    ? (value as BusinessType)
    : null;
}

/** Redirect away from feature-gated routes hidden for this business type. */
export function BusinessTypeRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: org, isLoading } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });

  if (isLoading) return null;

  const businessType = parseBusinessType(org?.businessType);
  const path = `/${location.pathname.split('/').filter(Boolean)[0] ?? ''}`;
  const normalized = path === '/' ? '/' : path;

  if (!isAdminNavPathVisible(businessType, normalized)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

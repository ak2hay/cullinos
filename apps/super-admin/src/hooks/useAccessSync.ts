import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { PlatformRole } from '@/lib/permissions';
import { iamApi } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

/**
 * Keeps the menu in step with live access (custom roles, expiring elevations, revocations)
 * without a re-login. The API enforces access regardless of what the menu shows.
 */
export function useAccessSync() {
  const token = useAuthStore((s) => s.accessToken);
  const updateAdmin = useAuthStore((s) => s.updateAdmin);
  const query = useQuery({
    queryKey: ['super-admin', 'iam', 'me'],
    queryFn: iamApi.me,
    enabled: Boolean(token),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const me = query.data;
    if (!me) return;
    updateAdmin({
      platformPermissions: me.permissions,
      scopedPermissions: [...new Set(me.scoped.flatMap((g) => g.permissions))],
      employeeCode: me.identity?.employeeCode ?? null,
      isOwner: me.isOwner,
      ...(me.primaryRole ? { platformRole: me.primaryRole as PlatformRole } : {}),
    });
  }, [query.data, updateAdmin]);

  return query.data;
}

import { useQuery } from '@tanstack/react-query';
import { outletUsesTables } from '@cullinos/shared';
import { organizationsApi, outletsApi, type Outlet } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

/**
 * The header-selected outlet's explicit table setting. `tablesEnabled` is
 * undefined when the outlet follows its business-type default.
 */
export function useSelectedOutletTables(): { tablesEnabled: boolean | undefined; isLoading: boolean } {
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const { data: outlets, isLoading } = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const outlet = outlets?.find((o) => o.id === selectedOutletId);
  return {
    tablesEnabled: typeof outlet?.tablesEnabled === 'boolean' ? outlet.tablesEnabled : undefined,
    isLoading,
  };
}

/** Whether an outlet runs the table system (its setting, else the business type). */
export function useOutletUsesTables(outlet?: Pick<Outlet, 'tablesEnabled'> | null): boolean {
  const { data: org } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });
  return outletUsesTables(org?.businessType ?? null, outlet ?? null);
}

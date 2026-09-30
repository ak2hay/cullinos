import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ChevronDown, Store } from 'lucide-react';
import { outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function OutletSelector() {
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  useEffect(() => {
    if (outlets.length === 0) return;
    const stillValid =
      selectedOutletId != null && outlets.some((o) => o.id === selectedOutletId);
    // Stale IDs (e.g. after re-seed) still render a label in some browsers but fail API calls.
    if (!stillValid) {
      setSelectedOutlet(outlets[0].id);
    }
  }, [outlets, selectedOutletId, setSelectedOutlet]);

  if (isLoading) {
    return <div className="ui-skeleton h-10 w-44 rounded-xl" />;
  }

  if (outlets.length === 0) {
    return (
      <span className="text-sm text-text-muted">No outlets</span>
    );
  }

  return (
    <label className="relative inline-flex min-w-0 items-center">
      <span className="sr-only">Outlet</span>
      <Store size={16} className="pointer-events-none absolute left-3 text-brand-primary" aria-hidden="true" />
      <select
        value={selectedOutletId ?? ''}
        onChange={(e) => setSelectedOutlet(e.target.value || null)}
        className="h-10 min-w-0 max-w-[14rem] appearance-none truncate rounded-xl border border-line bg-bg-card pl-9 pr-9 text-sm font-medium text-text-primary shadow-sm outline-none transition-colors hover:border-line-strong focus:border-brand-primary sm:max-w-[18rem]"
      >
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
            {outlet.city ? ` · ${outlet.city}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 text-text-muted" aria-hidden="true" />
    </label>
  );
}

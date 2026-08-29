import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
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
    if (!selectedOutletId && outlets.length > 0) {
      setSelectedOutlet(outlets[0].id);
    }
  }, [outlets, selectedOutletId, setSelectedOutlet]);

  if (isLoading) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-lg bg-bg-elevated" />
    );
  }

  if (outlets.length === 0) {
    return (
      <span className="text-sm text-text-muted">No outlets</span>
    );
  }

  return (
    <select
      value={selectedOutletId ?? ''}
      onChange={(e) => setSelectedOutlet(e.target.value || null)}
      className="h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-brand-primary"
    >
      {outlets.map((outlet) => (
        <option key={outlet.id} value={outlet.id}>
          {outlet.name}
          {outlet.city ? ` · ${outlet.city}` : ''}
        </option>
      ))}
    </select>
  );
}

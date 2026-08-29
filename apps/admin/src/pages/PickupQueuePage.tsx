import { useQuery } from '@tanstack/react-query';
import { DEFAULT_API_BASE } from '@cullinos/shared';
import { outletsApi } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;

export function PickupQueuePage() {
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const outletId = outletsQuery.data?.[0]?.id;

  const displayUrl = outletId
    ? `${API_BASE.replace('/api/v1', '')}/kds/?outletId=${outletId}&mode=pickup`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pickup queue</h1>
        <p className="text-sm text-text-secondary">
          Customer-facing order board for counter-service and peak-hour rush.
        </p>
      </div>

      {displayUrl ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Open this URL on a tablet or TV facing customers:
          </p>
          <code className="block rounded-lg border border-white/10 bg-bg-card p-3 text-sm text-brand-primary">
            {`http://localhost:5174/?outletId=${outletId}&mode=pickup`}
          </code>
          <p className="text-xs text-text-muted">
            KDS app with pickup mode shows preparing and ready orders in real time.
          </p>
        </div>
      ) : (
        <p className="text-text-muted">Loading outlets…</p>
      )}
    </div>
  );
}

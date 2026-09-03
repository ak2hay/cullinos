/**
 * Public customer-facing pickup queue display.
 * Accessed via /?outletId=...&mode=pickup — no login required.
 * Shows orders that are confirmed, preparing, or ready for counter / takeaway.
 */

import { useEffect, useState } from 'react';
import { DEFAULT_API_BASE } from '@cullinos/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;

interface PickupOrder {
  id: string;
  orderNumber: string;
  status: 'confirmed' | 'preparing' | 'ready' | string;
  type: string;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Preparing',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  preparing: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  ready: 'bg-green-500/20 text-green-300 border-green-500/30',
};

async function fetchPickupQueue(outletId: string): Promise<PickupOrder[]> {
  const res = await fetch(`${API_BASE}/public/orders/pickup-queue?outletId=${outletId}`);
  if (!res.ok) throw new Error('Failed to load queue');
  return res.json() as Promise<PickupOrder[]>;
}

export function PickupDisplayPage({ outletId }: { outletId: string }) {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await fetchPickupQueue(outletId);
      setOrders(data);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError('Unable to connect. Retrying…');
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, [outletId]);

  const preparing = orders.filter((o) => ['confirmed', 'preparing'].includes(o.status));
  const ready = orders.filter((o) => o.status === 'ready');

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 p-6 text-white">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-white">Order Status</h1>
        {lastUpdated && (
          <p className="text-sm text-gray-500">Updated {lastUpdated.toLocaleTimeString()}</p>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {orders.length === 0 && !error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xl text-gray-500">No active orders right now.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Preparing column */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-yellow-400">
              🔥 Preparing ({preparing.length})
            </h2>
            <div className="space-y-3">
              {preparing.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-6 py-4"
                >
                  <span className="text-2xl font-bold tracking-widest text-white">
                    #{order.orderNumber}
                  </span>
                  <span className="text-sm text-yellow-300">Preparing…</span>
                </div>
              ))}
              {preparing.length === 0 && (
                <p className="text-sm text-gray-600">No orders preparing.</p>
              )}
            </div>
          </div>

          {/* Ready column */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-green-400">
              ✅ Ready for Pickup ({ready.length})
            </h2>
            <div className="space-y-3">
              {ready.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/15 px-6 py-4"
                >
                  <span className="text-2xl font-bold tracking-widest text-white">
                    #{order.orderNumber}
                  </span>
                  <span className="text-sm font-semibold text-green-300">COLLECT NOW</span>
                </div>
              ))}
              {ready.length === 0 && (
                <p className="text-sm text-gray-600">No orders ready yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto pt-8 text-center text-xs text-gray-700">
        Auto-refreshes every 15 seconds
      </footer>
    </div>
  );
}

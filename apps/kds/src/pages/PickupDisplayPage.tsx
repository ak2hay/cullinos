/**
 * Public customer-facing pickup / CDS display.
 * Accessed via /?outletId=...&mode=pickup|cds — no login required.
 * McD-style board: huge order numbers, Preparing | Ready columns.
 */

import { useEffect, useState } from 'react';
import { DEFAULT_API_BASE } from '@cullinos/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;
const POLL_MS = 5_000;

interface PickupOrder {
  id: string;
  orderNumber: string;
  pickupCode?: string | null;
  status: string;
  type?: string;
}

function displayCode(order: PickupOrder): string {
  return order.pickupCode || order.orderNumber;
}

function normalizeStatus(status: string): string {
  return status.toLowerCase();
}

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
    const interval = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(interval);
  }, [outletId]);

  const preparing = orders.filter((o) =>
    ['confirmed', 'preparing'].includes(normalizeStatus(o.status)),
  );
  const ready = orders.filter((o) => normalizeStatus(o.status) === 'ready');

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_#1a1a2e_0%,_#0a0a12_60%)] p-6 text-white md:p-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">
            Cullinos
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Order Status</h1>
        </div>
        {lastUpdated ? (
          <p className="text-sm text-gray-500">Updated {lastUpdated.toLocaleTimeString()}</p>
        ) : null}
      </header>

      {error ? (
        <div className="mb-6 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      {orders.length === 0 && !error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-2xl text-gray-500">No active orders</p>
        </div>
      ) : (
        <div className="grid flex-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <h2 className="mb-6 border-b border-yellow-500/30 pb-3 text-2xl font-semibold uppercase tracking-widest text-yellow-400 md:text-3xl">
              Preparing
              <span className="ml-3 text-lg font-normal text-yellow-500/70">
                ({preparing.length})
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {preparing.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-center rounded-2xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-8"
                >
                  <span className="text-5xl font-black tracking-wider text-white md:text-6xl">
                    {displayCode(order)}
                  </span>
                </div>
              ))}
              {preparing.length === 0 ? (
                <p className="col-span-full text-lg text-gray-600">—</p>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="mb-6 border-b border-green-500/40 pb-3 text-2xl font-semibold uppercase tracking-widest text-green-400 md:text-3xl">
              Ready
              <span className="ml-3 text-lg font-normal text-green-500/70">({ready.length})</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {ready.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-green-400/50 bg-green-500/20 px-4 py-8"
                >
                  <span className="text-5xl font-black tracking-wider text-white md:text-6xl">
                    {displayCode(order)}
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-widest text-green-300">
                    Collect
                  </span>
                </div>
              ))}
              {ready.length === 0 ? (
                <p className="col-span-full text-lg text-gray-600">—</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto pt-10 text-center text-xs text-gray-700">
        Auto-refreshes every 5 seconds
      </footer>
    </div>
  );
}

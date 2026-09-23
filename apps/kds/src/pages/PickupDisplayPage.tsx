/**
 * Public customer-facing pickup / CDS display.
 * Accessed via /?orgSlug=...&outletSlug=...&mode=pickup|cds — no login required.
 */

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_API_BASE } from '@cullinos/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;
const POLL_MS = 5_000;
const HEARTBEAT_MS = 60_000;

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

/** Send heartbeat to the API so the admin hub can track this display as online. */
async function sendHeartbeat(orgSlug: string, outletSlug: string, mode: string) {
  try {
    await fetch(`${API_BASE}/public/promo-display/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug, outletSlug, mode }),
    });
  } catch {
    // best-effort
  }
}

async function fetchPickupQueue(orgSlug: string, outletSlug: string): Promise<PickupOrder[]> {
  const params = new URLSearchParams({ orgSlug, outletSlug });
  const res = await fetch(`${API_BASE}/public/orders/pickup-queue?${params}`);
  if (!res.ok) throw new Error('Failed to load queue');
  return res.json() as Promise<PickupOrder[]>;
}

export function PickupDisplayPage({
  orgSlug,
  outletSlug,
  mode = 'pickup',
}: {
  orgSlug: string;
  outletSlug: string;
  mode?: string;
}) {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const data = await fetchPickupQueue(orgSlug, outletSlug);
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
  }, [orgSlug, outletSlug]);

  // Heartbeat
  useEffect(() => {
    void sendHeartbeat(orgSlug, outletSlug, mode);
    heartbeatRef.current = setInterval(
      () => void sendHeartbeat(orgSlug, outletSlug, mode),
      HEARTBEAT_MS,
    );
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [orgSlug, outletSlug, mode]);

  // Fullscreen change listener
  useEffect(() => {
    function onChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

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
        <div className="flex items-center gap-3">
          {lastUpdated ? (
            <p className="text-sm text-gray-500">Updated {lastUpdated.toLocaleTimeString()}</p>
          ) : null}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white"
          >
            {isFullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></svg>
            )}
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-6 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      {orders.length === 0 && !error ? (
        <p className="text-center text-2xl text-gray-500">No active orders</p>
      ) : (
        <div className="grid flex-1 gap-8 md:grid-cols-2">
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-amber-400">Preparing</h2>
            <ul className="space-y-3">
              {preparing.map((order) => (
                <li
                  key={order.id}
                  className="rounded-2xl bg-white/5 px-6 py-5 text-center text-5xl font-bold tracking-wide"
                >
                  {displayCode(order)}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-emerald-400">Ready</h2>
            <ul className="space-y-3">
              {ready.map((order) => (
                <li
                  key={order.id}
                  className="rounded-2xl bg-emerald-500/15 px-6 py-5 text-center text-5xl font-bold tracking-wide text-emerald-300"
                >
                  {displayCode(order)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

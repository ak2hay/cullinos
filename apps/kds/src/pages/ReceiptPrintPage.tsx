/**
 * Counter receipt station — auto-prints QR slips for phone / online customer orders.
 * Opened via /?mode=receipt&outletId=… — keep this tab open on the printer PC.
 * Kiosk orders print locally on the tablet (notes start with "Kiosk ·") and are skipped here.
 */

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { resolveViteApiBase } from '@cullinos/shared';
import { useAuthStore } from '@/stores/auth';

const API_BASE = resolveViteApiBase({
  viteApiUrl: import.meta.env.VITE_API_URL,
  isProd: import.meta.env.PROD,
});
const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

interface ReceiptOrder {
  id: string;
  orderNumber: string;
  pickupCode?: string | null;
  status: string;
  source?: string;
  type?: string;
  notes?: string | null;
  customerName?: string | null;
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
}

function shouldAutoPrint(order: ReceiptOrder): boolean {
  const source = (order.source ?? '').toUpperCase();
  if (source !== 'CUSTOMER') return false;
  const status = (order.status ?? '').toLowerCase();
  if (!['confirmed', 'preparing', 'ready'].includes(status)) return false;
  const notes = order.notes ?? '';
  if (notes.includes('Kiosk ·')) return false;
  return Boolean(order.pickupCode || order.orderNumber);
}

function displayCode(order: ReceiptOrder): string {
  return order.pickupCode || order.orderNumber;
}

function qrImageUrl(order: ReceiptOrder, outletId: string): string {
  const code = displayCode(order);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    JSON.stringify({ code, orderId: order.id, outletId }),
  )}`;
}

export function ReceiptPrintPage({ outletId }: { outletId: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [lastPrinted, setLastPrinted] = useState<string | null>(null);
  const [slip, setSlip] = useState<ReceiptOrder | null>(null);
  const printedIds = useRef(new Set<string>());
  const printTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setStatus('error');
      return;
    }

    const socket: Socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      setStatus('live');
      socket.emit('join_outlet', outletId);
    });
    socket.on('disconnect', () => setStatus('connecting'));
    socket.on('connect_error', () => setStatus('error'));

    const onOrder = (payload: ReceiptOrder) => {
      if (!payload?.id || printedIds.current.has(payload.id)) return;
      if (!shouldAutoPrint(payload)) return;
      printedIds.current.add(payload.id);
      setSlip(payload);
      setLastPrinted(displayCode(payload));
      if (printTimer.current) clearTimeout(printTimer.current);
      printTimer.current = setTimeout(() => window.print(), 500);
    };

    socket.on('order.updated', onOrder);
    socket.on('order:updated', onOrder);

    return () => {
      if (printTimer.current) clearTimeout(printTimer.current);
      socket.disconnect();
    };
  }, [outletId, accessToken]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary p-8 text-text-primary">
      <div className="print:hidden mx-auto w-full max-w-lg space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">
          Cullinos
        </p>
        <h1 className="text-3xl font-bold">Receipt printer</h1>
        <p className="text-text-secondary">
          Leave this tab open. Phone / online orders print a 6-character QR ticket automatically.
          Set your mini thermal printer as the system default.
        </p>
        <p className="text-sm text-text-muted">
          Status:{' '}
          <span
            className={
              status === 'live'
                ? 'text-status-ready'
                : status === 'error'
                  ? 'text-status-error'
                  : 'text-text-secondary'
            }
          >
            {status === 'live' ? 'Listening' : status === 'error' ? 'Connection error' : 'Connecting…'}
          </span>
        </p>
        {lastPrinted ? (
          <p className="font-mono text-2xl text-brand-primary">Last printed: {lastPrinted}</p>
        ) : (
          <p className="text-text-muted">Waiting for phone orders…</p>
        )}
        {slip ? (
          <button
            type="button"
            className="rounded-xl bg-brand-primary px-4 py-3 font-semibold text-bg-primary"
            onClick={() => window.print()}
          >
            Reprint last
          </button>
        ) : null}
      </div>

      {slip ? (
        <div className="ticket-slip mx-auto mt-8 hidden w-[54mm] space-y-2 text-center text-black print:block">
          <p className="text-xs font-semibold uppercase tracking-widest">Cullinos</p>
          <p className="text-sm">Pickup code</p>
          <p className="font-mono text-4xl font-black tracking-widest">{displayCode(slip)}</p>
          <img
            src={qrImageUrl(slip, outletId)}
            alt={`QR ${displayCode(slip)}`}
            className="mx-auto h-36 w-36 bg-white p-1"
          />
          {slip.customerName ? <p className="text-xs">{slip.customerName}</p> : null}
          <ul className="space-y-0.5 text-left text-xs">
            {(slip.items ?? []).map((item) => (
              <li key={`${item.name}-${item.quantity}`} className="flex justify-between gap-2">
                <span>
                  {item.quantity}× {item.name}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-600">Kitchen #{slip.orderNumber}</p>
        </div>
      ) : null}

      <style>{`
        @media print {
          @page { size: 58mm auto; margin: 2mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          .ticket-slip, .ticket-slip * { visibility: visible; }
          .ticket-slip {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 54mm;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

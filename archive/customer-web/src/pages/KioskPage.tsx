import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandWordmark } from '@cullinos/ui';
import { ModifierModal } from '@/components/ModifierModal';
import {
  formatPrice,
  hasApiAccess,
  menuApi,
  ordersApi,
  type MenuItem,
} from '@/lib/api';
import { useSessionStore } from '@/stores/session';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';

interface KioskLine {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  variantId?: string;
  variantName?: string;
}

type Step = 'menu' | 'cart' | 'done';

export function KioskPage() {
  const navigate = useNavigate();
  const base = useStorefrontBase();
  const organizationSlug = useSessionStore((s) => s.organizationSlug);
  const outletId = useSessionStore((s) => s.outletId);
  const outletSlug = useSessionStore((s) => s.outletSlug);
  const organizationName = useSessionStore((s) => s.organizationName);
  const outletName = useSessionStore((s) => s.outletName);
  const logoUrl = useSessionStore((s) => s.logoUrl);

  const [step, setStep] = useState<Step>('menu');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [lines, setLines] = useState<KioskLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [guestName, setGuestName] = useState('');
  const [orderType, setOrderType] = useState<'takeaway' | 'dine_in'>('takeaway');
  const [placed, setPlaced] = useState<{
    id: string;
    orderNumber: string;
    pickupCode: string;
  } | null>(null);
  const [receiptLines, setReceiptLines] = useState<KioskLine[]>([]);
  const [error, setError] = useState('');

  const menuQuery = useQuery({
    queryKey: ['kiosk-menu', outletId],
    queryFn: () => menuApi.getOutletMenu(outletId!),
    enabled: Boolean(outletId) && hasApiAccess(),
  });

  const categories = menuQuery.data?.categories ?? [];
  const items = useMemo(() => {
    const all = (menuQuery.data?.items ?? []).filter((i) => i.isAvailable);
    if (!categoryId) return all;
    return all.filter((i) => i.categoryId === categoryId);
  }, [menuQuery.data?.items, categoryId]);

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  function addSimpleItem(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id && !l.variantId);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === item.id && !l.variantId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          unitPrice: item.price,
          quantity: 1,
        },
      ];
    });
  }

  function handleItemTap(item: MenuItem) {
    const hasOptions =
      (item.modifierGroups?.length ?? 0) > 0 || (item.variants?.length ?? 0) > 0;
    if (hasOptions) {
      setSelectedItem(item);
    } else {
      addSimpleItem(item);
    }
  }

  function updateQty(menuItemId: string, quantity: number, variantId?: string) {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => !(l.menuItemId === menuItemId && l.variantId === variantId))
        : prev.map((l) =>
            l.menuItemId === menuItemId && l.variantId === variantId
              ? { ...l, quantity }
              : l,
          ),
    );
  }

  const placeMutation = useMutation({
    mutationFn: async () => {
      if (!organizationSlug || !outletSlug) throw new Error('Store not loaded');
      if (lines.length === 0) throw new Error('Cart is empty');
      return ordersApi.create({
        orgSlug: organizationSlug,
        outletSlug,
        source: 'QR',
        type: orderType,
        customerName: guestName.trim() || 'Kiosk guest',
        notes: `Kiosk · ${orderType === 'takeaway' ? 'Pickup' : 'Eat in'} · Pay at counter`,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          variantId: l.variantId,
        })),
      });
    },
    onSuccess: (order) => {
      setReceiptLines([...lines]);
      setPlaced({
        id: order.id,
        orderNumber: order.orderNumber,
        pickupCode: order.pickupCode || order.orderNumber,
      });
      setLines([]);
      setStep('done');
      setError('');
      setTimeout(() => window.print(), 600);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not place order');
    },
  });

  function startOver() {
    setPlaced(null);
    setReceiptLines([]);
    setGuestName('');
    setStep('menu');
    setError('');
  }

  const qrUrl = placed
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        JSON.stringify({
          code: placed.pickupCode,
          orderId: placed.id,
          outletId,
        }),
      )}`
    : null;

  if (step === 'done' && placed) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
        <div className="ticket-screen mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="ticket-slip w-full max-w-[58mm] space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-primary">
              {organizationName ?? 'Cullinos'}
            </p>
            <h1 className="text-3xl font-bold print:text-lg">Order placed</h1>
            <p className="text-text-secondary print:text-xs">
              Show this ticket at the counter to pay
            </p>
            <p className="font-mono text-7xl font-black tracking-widest text-brand-primary print:text-4xl">
              {placed.pickupCode}
            </p>
            <p className="text-xs text-text-muted print:hidden">
              Kitchen #{placed.orderNumber}
            </p>
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={`QR for code ${placed.pickupCode}`}
                className="mx-auto h-52 w-52 rounded-2xl bg-white p-3 print:h-36 print:w-36 print:rounded-none"
              />
            ) : null}
            <ul className="w-full space-y-1 text-left text-sm text-text-secondary print:text-xs">
              {receiptLines.map((line, idx) => (
                <li key={`${line.menuItemId}-${line.variantId ?? ''}-${idx}`} className="flex justify-between gap-4">
                  <span>
                    {line.quantity}× {line.name}
                    {line.variantName ? ` (${line.variantName})` : ''}
                  </span>
                  <span className="font-mono">{formatPrice(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex w-full flex-col gap-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-14 rounded-2xl bg-brand-primary text-lg font-bold text-bg-primary"
            >
              Print ticket
            </button>
            <button
              type="button"
              onClick={startOver}
              className="h-14 rounded-2xl border border-white/15 text-lg font-semibold"
            >
              New order
            </button>
          </div>
        </div>
        <style>{`
          @media print {
            @page { size: 58mm auto; margin: 2mm; }
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden; }
            .ticket-slip, .ticket-slip * { visibility: visible; }
            .ticket-slip {
              position: absolute;
              left: 0;
              top: 0;
              width: 54mm;
              max-width: 54mm;
              padding: 0;
              text-align: center;
            }
            .print\\:hidden { display: none !important; }
          }
        `}</style>
      </div>
    );
  }

  if (step === 'cart') {
    return (
      <div className="flex min-h-screen flex-col bg-bg-primary">
        <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="rounded-xl px-4 py-3 text-lg font-medium text-text-secondary"
          >
            ← Menu
          </button>
          <h1 className="text-xl font-semibold">Your order</h1>
          <span className="w-20" />
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {lines.map((line, idx) => (
            <div
              key={`${line.menuItemId}-${line.variantId ?? ''}-${idx}`}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-bg-card p-4"
            >
              <div>
                <p className="text-lg font-semibold">
                  {line.name}
                  {line.variantName ? (
                    <span className="text-sm font-normal text-text-muted"> · {line.variantName}</span>
                  ) : null}
                </p>
                <p className="font-mono text-brand-primary">
                  {formatPrice(line.unitPrice * line.quantity)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated text-2xl"
                  onClick={() => updateQty(line.menuItemId, line.quantity - 1, line.variantId)}
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center font-mono text-xl">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/20 text-2xl text-brand-primary"
                  onClick={() => updateQty(line.menuItemId, line.quantity + 1, line.variantId)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <input
            type="text"
            placeholder="Name on order (optional)"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-bg-elevated px-4 py-4 text-lg outline-none focus:border-brand-primary"
          />
          <div className="grid grid-cols-2 gap-3">
            {(['takeaway', 'dine_in'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={`rounded-2xl border py-4 text-lg font-semibold ${
                  orderType === type
                    ? 'border-brand-primary bg-brand-primary text-bg-primary'
                    : 'border-white/10 bg-bg-card'
                }`}
              >
                {type === 'takeaway' ? 'Pickup' : 'Eat in'}
              </button>
            ))}
          </div>
          {error ? <p className="text-status-error">{error}</p> : null}
        </div>
        <div className="border-t border-white/5 p-6">
          <div className="mb-4 flex justify-between text-xl">
            <span>Total</span>
            <span className="font-mono font-bold text-brand-primary">
              {formatPrice(total)}
            </span>
          </div>
          <button
            type="button"
            disabled={lines.length === 0 || placeMutation.isPending}
            onClick={() => placeMutation.mutate()}
            className="h-16 w-full rounded-2xl bg-brand-primary text-xl font-bold text-bg-primary disabled:opacity-40"
          >
            {placeMutation.isPending ? 'Placing…' : 'Place order · Pay at counter'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_#1a1a2e_0%,_#0f0f1a_55%)]">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-5">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <BrandWordmark size="sm" />
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">
              {organizationName ?? 'Cullinos'}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight">{outletName ?? 'Order here'}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(base)}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-text-muted print:hidden"
        >
          Phone menu
        </button>
      </header>

      <div className="flex gap-3 overflow-x-auto px-6 py-4">
        <button
          type="button"
          onClick={() => setCategoryId(null)}
          className={`shrink-0 rounded-full px-6 py-3 text-base font-semibold ${
            !categoryId
              ? 'bg-brand-primary text-bg-primary'
              : 'border border-white/10 bg-bg-card text-text-secondary'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryId(cat.id)}
            className={`shrink-0 rounded-full px-6 py-3 text-base font-semibold ${
              categoryId === cat.id
                ? 'bg-brand-primary text-bg-primary'
                : 'border border-white/10 bg-bg-card text-text-secondary'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-28">
        {menuQuery.isLoading ? (
          <p className="py-20 text-center text-text-muted">Loading menu…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemTap(item)}
                className="flex min-h-[180px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-card text-left transition active:scale-[0.97] hover:border-brand-primary/40"
              >
                <div className="h-28 w-full bg-bg-elevated">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-end bg-gradient-to-br from-bg-elevated to-brand-primary/25 p-3">
                      <span className="font-display text-sm font-bold text-brand-primary/80">Cullinos.</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <span className="line-clamp-2 text-lg font-semibold leading-tight">
                    {item.name}
                  </span>
                  <span className="mt-3 rounded-xl bg-brand-primary/15 px-3 py-1.5 font-mono text-base font-bold text-brand-primary">
                    {formatPrice(item.price)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-bg-secondary/95 p-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setStep('cart')}
            className="flex h-16 w-full items-center justify-between rounded-2xl bg-brand-primary px-6 text-lg font-bold text-bg-primary"
          >
            <span>
              View order · {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            <span className="font-mono">{formatPrice(total)}</span>
          </button>
        </div>
      ) : null}

      <ModifierModal
        item={selectedItem}
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        onAdd={(payload) => {
          if (!selectedItem) return;
          setLines((prev) => [
            ...prev,
            {
              menuItemId: selectedItem.id,
              name: selectedItem.name,
              unitPrice: payload.unitPrice + payload.modifiers.reduce((s, m) => s + m.price, 0),
              quantity: payload.quantity,
              variantId: payload.variantId,
              variantName: payload.variantName,
            },
          ]);
          setSelectedItem(null);
        }}
      />
    </div>
  );
}

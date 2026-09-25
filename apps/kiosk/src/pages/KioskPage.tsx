import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { BrandWordmark } from '@cullinos/ui';
import { ModifierModal, type ModifierSelection } from '@/components/ModifierModal';
import { formatPrice, kioskApi, type MenuItem, type PlacedOrder } from '@/lib/api';

interface KioskLine {
  key: string;
  menuItemId: string;
  name: string;
  /** Paise, including modifiers */
  unitPrice: number;
  quantity: number;
  variantId?: string;
  variantName?: string;
  modifiers: ModifierSelection[];
  notes?: string;
}

type Step = 'welcome' | 'menu' | 'cart' | 'done';

/** Return to the welcome screen after this long without a touch. */
const IDLE_RESET_MS = 120_000;
/** Confirmation screen auto-clears for the next guest. */
const DONE_RESET_MS = 30_000;

export function KioskPage() {
  const { orgSlug = '', outletSlug = '' } = useParams();
  const [step, setStep] = useState<Step>('welcome');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [lines, setLines] = useState<KioskLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [guestName, setGuestName] = useState('');
  const [orderType, setOrderType] = useState<'takeaway' | 'dine_in'>('takeaway');
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [receiptLines, setReceiptLines] = useState<KioskLine[]>([]);
  const [error, setError] = useState('');
  const [doneCountdown, setDoneCountdown] = useState(DONE_RESET_MS / 1000);
  const idleTimer = useRef<number | undefined>(undefined);

  const storefront = useQuery({
    queryKey: ['kiosk-storefront', orgSlug, outletSlug],
    queryFn: () => kioskApi.storefront(orgSlug, outletSlug),
    enabled: Boolean(orgSlug && outletSlug),
    refetchInterval: 5 * 60_000,
  });

  const data = storefront.data;
  const categories = data?.menu.categories ?? [];
  const availableItems = useMemo(
    () => (data?.menu.items ?? []).filter((i) => i.isAvailable !== false),
    [data?.menu.items],
  );
  const visibleCategories = useMemo(
    () => categories.filter((c) => availableItems.some((i) => i.categoryId === c.id)),
    [categories, availableItems],
  );
  const items = useMemo(
    () => (categoryId ? availableItems.filter((i) => i.categoryId === categoryId) : availableItems),
    [availableItems, categoryId],
  );

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const resetAll = useCallback(() => {
    setLines([]);
    setPlaced(null);
    setReceiptLines([]);
    setGuestName('');
    setOrderType('takeaway');
    setCategoryId(null);
    setSelectedItem(null);
    setError('');
    setStep('welcome');
  }, []);

  useEffect(() => {
    if (step === 'welcome' || step === 'done') return;
    const bump = () => {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(resetAll, IDLE_RESET_MS);
    };
    bump();
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, [step, resetAll]);

  useEffect(() => {
    if (step !== 'done') return;
    setDoneCountdown(DONE_RESET_MS / 1000);
    const tick = window.setInterval(() => {
      setDoneCountdown((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          resetAll();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [step, resetAll]);

  function addLine(line: Omit<KioskLine, 'key'>) {
    const key = [
      line.menuItemId,
      line.variantId ?? '',
      line.modifiers.map((m) => m.id).sort().join(','),
      line.notes ?? '',
    ].join('|');
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + line.quantity } : l));
      }
      return [...prev, { ...line, key }];
    });
  }

  function handleItemTap(item: MenuItem) {
    const hasOptions = (item.modifierGroups?.length ?? 0) > 0 || (item.variants?.length ?? 0) > 0;
    if (hasOptions) {
      setSelectedItem(item);
      return;
    }
    addLine({
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      quantity: 1,
      modifiers: [],
    });
  }

  function updateQty(key: string, quantity: number) {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, quantity } : l)),
    );
  }

  const placeMutation = useMutation({
    mutationFn: () =>
      kioskApi.placeOrder({
        orgSlug,
        outletSlug,
        source: 'QR',
        type: orderType,
        customerName: guestName.trim() || 'Kiosk guest',
        notes: `Kiosk · ${orderType === 'takeaway' ? 'Pickup' : 'Eat in'} · Pay at counter`,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          variantId: l.variantId,
          notes: l.notes,
          modifiers: l.modifiers.length
            ? l.modifiers.map((m) => ({ modifierId: m.id, name: m.name, price: m.price }))
            : undefined,
        })),
      }),
    onSuccess: (order) => {
      setReceiptLines(lines);
      setPlaced(order);
      setLines([]);
      setError('');
      setStep('done');
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not place order'),
  });

  if (!orgSlug || !outletSlug) {
    return <FullMessage title="Kiosk link is incomplete" body="Open the kiosk link from Admin → Digital Ordering." />;
  }

  if (storefront.isLoading) {
    return <FullMessage title="Loading menu…" />;
  }

  if (storefront.isError || !data) {
    return (
      <FullMessage
        title="This kiosk is not available"
        body={
          storefront.error instanceof Error
            ? storefront.error.message
            : 'The restaurant or outlet could not be found. Check the kiosk link.'
        }
        action={
          <button
            type="button"
            onClick={() => void storefront.refetch()}
            className="h-14 rounded-2xl bg-brand-primary px-8 text-lg font-bold text-bg-primary"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (step === 'welcome') {
    return (
      <button
        type="button"
        onClick={() => setStep('menu')}
        className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden text-center"
      >
        {data.coverImageUrl ? (
          <img
            src={data.coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(15,15,26,0.55)_0%,_#0f0f1a_75%)]" />
        <div className="relative flex flex-col items-center gap-6 p-8">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt="" className="h-28 w-28 rounded-3xl object-cover shadow-2xl" />
          ) : (
            <BrandWordmark size="lg" />
          )}
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-primary">
            {data.organizationName}
          </p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            {data.outletName}
          </h1>
          <p className="text-xl text-text-secondary">Order here, pay at the counter</p>
          <span className="mt-6 inline-flex h-20 items-center rounded-3xl bg-brand-primary px-12 text-2xl font-bold text-bg-primary shadow-lg animate-pulse">
            Tap to start ordering
          </span>
        </div>
      </button>
    );
  }

  if (step === 'done' && placed) {
    const code = placed.pickupCode || placed.orderNumber;
    return (
      <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="ticket-slip w-full space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-primary">
              {data.organizationName}
            </p>
            <h1 className="text-3xl font-bold print:text-lg">Order placed</h1>
            <p className="text-text-secondary print:text-xs">Show this code at the counter to pay</p>
            <p className="font-mono text-7xl font-black tracking-widest text-brand-primary print:text-4xl">
              {code}
            </p>
            <p className="text-xs text-text-muted">Order #{placed.orderNumber}</p>
            <ul className="w-full space-y-1 text-left text-sm text-text-secondary print:text-xs">
              {receiptLines.map((line) => (
                <li key={line.key} className="flex justify-between gap-4">
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
              className="h-14 rounded-2xl border border-white/15 text-lg font-semibold"
            >
              Print ticket
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="h-16 rounded-2xl bg-brand-primary text-lg font-bold text-bg-primary"
            >
              Done · next guest ({doneCountdown}s)
            </button>
          </div>
        </div>
        <style>{`
          @media print {
            @page { size: 58mm auto; margin: 2mm; }
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden; }
            .ticket-slip, .ticket-slip * { visibility: visible; }
            .ticket-slip { position: absolute; left: 0; top: 0; width: 54mm; text-align: center; }
          }
        `}</style>
      </div>
    );
  }

  if (step === 'cart') {
    return (
      <div className="flex h-screen flex-col bg-bg-primary">
        <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="h-14 rounded-2xl bg-bg-card px-5 text-lg font-semibold text-text-secondary"
          >
            ← Add more
          </button>
          <h1 className="font-display text-2xl font-bold">Your order</h1>
          <span className="w-28" />
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
          {lines.length === 0 ? (
            <p className="py-16 text-center text-lg text-text-muted">Your order is empty.</p>
          ) : null}
          {lines.map((line) => (
            <div
              key={line.key}
              className="flex items-center justify-between gap-4 rounded-3xl border border-white/5 bg-bg-card p-4"
            >
              <div className="min-w-0">
                <p className="text-lg font-semibold">
                  {line.name}
                  {line.variantName ? (
                    <span className="text-sm font-normal text-text-muted"> · {line.variantName}</span>
                  ) : null}
                </p>
                {line.modifiers.length ? (
                  <p className="truncate text-sm text-text-muted">
                    {line.modifiers.map((m) => m.name).join(', ')}
                  </p>
                ) : null}
                <p className="font-mono text-brand-primary">{formatPrice(line.unitPrice * line.quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  aria-label={`Remove one ${line.name}`}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated text-2xl"
                  onClick={() => updateQty(line.key, line.quantity - 1)}
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center font-mono text-xl">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={`Add one ${line.name}`}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/20 text-2xl text-brand-primary"
                  onClick={() => updateQty(line.key, line.quantity + 1)}
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
            maxLength={60}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full select-text rounded-2xl border border-white/10 bg-bg-elevated px-5 py-5 text-lg outline-none focus:border-brand-primary"
          />
          <div className="grid grid-cols-2 gap-3">
            {(['takeaway', 'dine_in'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={`rounded-2xl border py-5 text-lg font-semibold ${
                  orderType === type
                    ? 'border-brand-primary bg-brand-primary text-bg-primary'
                    : 'border-white/10 bg-bg-card'
                }`}
              >
                {type === 'takeaway' ? 'Takeaway' : 'Eat in'}
              </button>
            ))}
          </div>
          {error ? (
            <p className="rounded-2xl bg-status-error/10 px-4 py-3 text-status-error">{error}</p>
          ) : null}
        </div>
        <div className="border-t border-white/5 p-6">
          <div className="mb-4 flex justify-between text-xl">
            <span>Total</span>
            <span className="font-mono font-bold text-brand-primary">{formatPrice(total)}</span>
          </div>
          <button
            type="button"
            disabled={lines.length === 0 || placeMutation.isPending}
            onClick={() => placeMutation.mutate()}
            className="h-16 w-full rounded-2xl bg-brand-primary text-xl font-bold text-bg-primary disabled:opacity-40"
          >
            {placeMutation.isPending ? 'Placing order…' : 'Place order · Pay at counter'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[radial-gradient(ellipse_at_top,_#1a1a2e_0%,_#0f0f1a_55%)]">
      <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <BrandWordmark size="sm" showMark />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              {data.organizationName}
            </p>
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">{data.outletName}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="h-12 shrink-0 rounded-2xl border border-white/10 px-4 text-sm font-semibold text-text-secondary"
        >
          Start over
        </button>
      </header>

      <nav className="flex shrink-0 gap-3 overflow-x-auto px-6 py-4">
        <CategoryChip label="All" active={!categoryId} onClick={() => setCategoryId(null)} />
        {visibleCategories.map((cat) => (
          <CategoryChip
            key={cat.id}
            label={cat.name}
            active={categoryId === cat.id}
            onClick={() => setCategoryId(cat.id)}
          />
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-32">
        {items.length === 0 ? (
          <p className="py-20 text-center text-lg text-text-muted">No items available right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const inCart = lines
                .filter((l) => l.menuItemId === item.id)
                .reduce((s, l) => s + l.quantity, 0);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemTap(item)}
                  className="relative flex min-h-[200px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-card text-left transition active:scale-[0.97]"
                >
                  <div className="h-32 w-full bg-bg-elevated">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-end bg-gradient-to-br from-bg-elevated to-brand-primary/25 p-3">
                        <span className="font-display text-sm font-bold text-brand-primary/80">Cullinos.</span>
                      </div>
                    )}
                  </div>
                  {inCart > 0 ? (
                    <span className="absolute right-3 top-3 flex h-9 min-w-9 items-center justify-center rounded-full bg-brand-primary px-2 font-mono text-base font-bold text-bg-primary">
                      {inCart}
                    </span>
                  ) : null}
                  <div className="flex flex-1 flex-col justify-between gap-3 p-4">
                    <span className="line-clamp-2 text-lg font-semibold leading-tight">
                      {item.isVeg != null ? (
                        <span
                          aria-label={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                          className={`mr-2 inline-block h-3 w-3 rounded-sm border-2 align-middle ${
                            item.isVeg ? 'border-green-500 bg-green-500/40' : 'border-red-500 bg-red-500/40'
                          }`}
                        />
                      ) : null}
                      {item.name}
                    </span>
                    <span className="self-start rounded-xl bg-brand-primary/15 px-3 py-1.5 font-mono text-base font-bold text-brand-primary">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-bg-secondary/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
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
        onClose={() => setSelectedItem(null)}
        onAdd={(payload) => {
          if (!selectedItem) return;
          addLine({
            menuItemId: selectedItem.id,
            name: selectedItem.name,
            unitPrice: payload.unitPrice + payload.modifiers.reduce((s, m) => s + m.price, 0),
            quantity: payload.quantity,
            variantId: payload.variantId,
            variantName: payload.variantName,
            modifiers: payload.modifiers,
            notes: payload.notes,
          });
          setSelectedItem(null);
        }}
      />
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 shrink-0 rounded-full px-7 text-base font-semibold ${
        active ? 'bg-brand-primary text-bg-primary' : 'border border-white/10 bg-bg-card text-text-secondary'
      }`}
    >
      {label}
    </button>
  );
}

function FullMessage({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <BrandWordmark size="lg" />
      <h1 className="text-2xl font-bold">{title}</h1>
      {body ? <p className="max-w-md text-text-secondary">{body}</p> : null}
      {action}
    </div>
  );
}

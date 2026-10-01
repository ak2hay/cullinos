import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BrandWordmark, PhoneField } from '@cullinos/ui';
import { AppBanner } from '@/components/AppBanner';
import { ModifierModal, type ModifierSelection } from '@/components/ModifierModal';
import {
  formatPrice,
  orderApi,
  phoneError,
  type MenuItem,
  type OrderLineInput,
  type PlacedOrder,
} from '@/lib/api';

interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  isAlcohol: boolean;
  /** Paise, including modifiers */
  unitPrice: number;
  quantity: number;
  variantId?: string;
  variantName?: string;
  modifiers: ModifierSelection[];
  notes?: string;
}

type Step = 'menu' | 'cart' | 'done';

export function MenuPage() {
  const { orgSlug = '', outletSlug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const sessionParam = searchParams.get('session')?.trim() ?? '';
  const tableParam = searchParams.get('table')?.trim() ?? '';
  const isTableFlow = Boolean(sessionParam || tableParam);

  const [step, setStep] = useState<Step>('menu');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [receiptLines, setReceiptLines] = useState<CartLine[]>([]);
  const [error, setError] = useState('');

  const storefront = useQuery({
    queryKey: ['storefront', orgSlug, outletSlug],
    queryFn: () => orderApi.storefront(orgSlug, outletSlug),
    enabled: Boolean(orgSlug && outletSlug),
    refetchInterval: 5 * 60_000,
  });

  const sessionLookup = useQuery({
    queryKey: ['public-session', sessionParam],
    queryFn: () => orderApi.validateSession(sessionParam),
    enabled: Boolean(sessionParam),
    retry: false,
  });

  const sessionOk = sessionLookup.data?.sessionActive === true;

  const joinLookup = useQuery({
    queryKey: ['join-table', tableParam],
    queryFn: () => orderApi.joinTable(tableParam),
    enabled: Boolean(tableParam) && !sessionParam,
    retry: false,
  });

  const sessionToken = sessionOk
    ? sessionLookup.data?.sessionToken
    : !sessionParam
      ? joinLookup.data?.sessionToken
      : undefined;
  const tableName = sessionOk
    ? sessionLookup.data?.tableName
    : !sessionParam
      ? joinLookup.data?.tableName
      : undefined;

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
  const hasAlcohol = lines.some((l) => l.isAlcohol);
  const nameError = submitted && !guestName.trim() ? 'Enter your name' : '';
  const phoneFieldError = submitted ? phoneError(phone) ?? '' : '';

  function addLine(line: Omit<CartLine, 'key'>) {
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
      isAlcohol: Boolean(item.isAlcohol),
      unitPrice: item.price,
      quantity: 1,
      modifiers: [],
    });
  }

  function updateQty(key: string, quantity: number) {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity } : l)),
    );
  }

  const placeMutation = useMutation({
    mutationFn: async () => {
      const name = guestName.trim();
      const invalidPhone = phoneError(phone);
      if (!name) throw new Error('Enter your name');
      if (invalidPhone) throw new Error(invalidPhone);
      if (hasAlcohol && !ageConfirmed) throw new Error('Confirm you are of legal drinking age');
      if (isTableFlow && !sessionToken) throw new Error('This table link is not active');

      const orderNotes = [
        notes.trim() || null,
        `Phone: ${phone}`,
        isTableFlow ? 'Payment: Pay at table' : 'Payment: Pay at counter',
      ]
        .filter(Boolean)
        .join(' · ');

      const payloadItems: OrderLineInput[] = lines.map((l) => ({
        menuItemId: l.menuItemId,
        quantity: l.quantity,
        variantId: l.variantId,
        notes: l.notes,
        modifiers: l.modifiers.length
          ? l.modifiers.map((m) => ({ modifierId: m.id, name: m.name, price: m.price }))
          : undefined,
      }));

      if (isTableFlow && sessionToken) {
        await orderApi.addSessionItems(sessionToken, {
          items: payloadItems,
          customerName: name,
          notes: orderNotes,
          ageConfirmed: hasAlcohol ? true : undefined,
        });
        return orderApi.submitSession(sessionToken);
      }

      return orderApi.placeOrder({
        orgSlug,
        outletSlug,
        type: orderType,
        customerName: name,
        notes: orderNotes,
        items: payloadItems,
        ageConfirmed: hasAlcohol ? true : undefined,
      });
    },
    onSuccess: (order) => {
      setReceiptLines(lines);
      setPlaced(order);
      setLines([]);
      setError('');
      setStep('done');
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not place order'),
  });

  function tryPlace() {
    setSubmitted(true);
    if (!guestName.trim() || phoneError(phone)) {
      setError('');
      return;
    }
    if (hasAlcohol && !ageConfirmed) {
      setError('Confirm you are of legal drinking age');
      return;
    }
    setError('');
    placeMutation.mutate();
  }

  const linkLoading =
    (Boolean(sessionParam) && sessionLookup.isLoading) ||
    (Boolean(tableParam) && !sessionParam && joinLookup.isLoading);

  if (!orgSlug || !outletSlug) {
    return <FullMessage title="This ordering link is incomplete" />;
  }

  if (storefront.isLoading || linkLoading) {
    return <FullMessage title="Loading menu…" />;
  }

  if (storefront.isError || !data) {
    return (
      <FullMessage
        title="This restaurant is not available"
        body={
          storefront.error instanceof Error
            ? storefront.error.message
            : 'Check the QR code and try again.'
        }
        action={<RetryButton onClick={() => void storefront.refetch()} />}
      />
    );
  }

  if (sessionParam && (sessionLookup.isError || !sessionOk)) {
    return (
      <FullMessage
        title="This table link has expired"
        body="Ask the staff for a new QR code."
        action={<RetryButton onClick={() => void sessionLookup.refetch()} />}
      />
    );
  }

  if (!sessionParam && tableParam && joinLookup.isError) {
    return (
      <FullMessage
        title="This table QR could not be opened"
        body={joinLookup.error instanceof Error ? joinLookup.error.message : 'Ask the staff for help.'}
        action={<RetryButton onClick={() => void joinLookup.refetch()} />}
      />
    );
  }

  const banner = (
    <AppBanner org={orgSlug} outlet={outletSlug} table={tableParam || undefined} session={sessionToken || sessionParam || undefined} />
  );

  if (step === 'done' && placed) {
    return (
      <div className="min-h-screen bg-bg-primary">
        {banner}
        <main className="mx-auto flex max-w-lg flex-col items-center gap-5 px-5 py-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">
            {data.outletName}
          </p>
          <h1 className="font-display text-3xl font-bold">Order placed</h1>
          <p className="text-text-secondary">
            {tableName
              ? `We'll send this to the kitchen for ${tableName}. Pay at the table.`
              : 'Show this at the counter to pay.'}
          </p>
          <p className="font-mono text-4xl font-black tracking-wide text-brand-primary">{placed.orderNumber}</p>
          {placed.pickupCode ? (
            <p className="text-sm text-text-secondary">
              Pickup code <span className="font-mono font-bold text-text-primary">{placed.pickupCode}</span>
            </p>
          ) : null}
          {tableName ? <p className="text-sm text-text-muted">Table {tableName}</p> : null}
          <ul className="w-full space-y-1 text-left text-sm text-text-secondary">
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
          <button
            type="button"
            onClick={() => {
              setPlaced(null);
              setReceiptLines([]);
              setNotes('');
              setAgeConfirmed(false);
              setSubmitted(false);
              setStep('menu');
            }}
            className="h-12 w-full rounded-xl bg-brand-primary font-bold text-on-brand"
          >
            Order something else
          </button>
        </main>
      </div>
    );
  }

  if (step === 'cart') {
    return (
      <div className="flex min-h-screen flex-col bg-bg-primary">
        {banner}
        <header className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="rounded-xl bg-bg-card px-3 py-2 text-sm font-semibold text-text-secondary"
          >
            ← Menu
          </button>
          <h1 className="font-display text-lg font-bold">Your order</h1>
        </header>
        <div className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto p-4 pb-40">
          {lines.length === 0 ? <p className="py-10 text-center text-text-muted">Your order is empty.</p> : null}
          {lines.map((line) => (
            <div
              key={line.key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-bg-card p-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {line.name}
                  {line.variantName ? (
                    <span className="text-sm font-normal text-text-muted"> · {line.variantName}</span>
                  ) : null}
                </p>
                {line.modifiers.length ? (
                  <p className="truncate text-sm text-text-muted">{line.modifiers.map((m) => m.name).join(', ')}</p>
                ) : null}
                <p className="font-mono text-sm text-brand-primary">{formatPrice(line.unitPrice * line.quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <QtyButton label={`Remove one ${line.name}`} onClick={() => updateQty(line.key, line.quantity - 1)}>
                  −
                </QtyButton>
                <span className="min-w-[1.5rem] text-center font-mono">{line.quantity}</span>
                <QtyButton label={`Add one ${line.name}`} onClick={() => updateQty(line.key, line.quantity + 1)}>
                  +
                </QtyButton>
              </div>
            </div>
          ))}

          <label className="block text-sm font-semibold text-text-secondary" htmlFor="guest-name">
            Name
          </label>
          <input
            id="guest-name"
            type="text"
            value={guestName}
            maxLength={60}
            autoComplete="name"
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-3 outline-none focus:border-brand-primary"
            placeholder="Your name"
          />
          {nameError ? <p className="text-sm text-status-error">{nameError}</p> : null}

          <PhoneField label="Phone" value={phone} onChange={setPhone} required error={phoneFieldError || undefined} />

          <label className="block text-sm font-semibold text-text-secondary" htmlFor="order-notes">
            Note for the kitchen
          </label>
          <textarea
            id="order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-3 outline-none focus:border-brand-primary"
            placeholder="Optional"
          />

          {isTableFlow ? (
            <p className="rounded-xl bg-bg-card px-4 py-3 text-sm text-text-secondary">
              {tableName ? `Table ${tableName}. ` : ''}
              Pay at the table when you are ready.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(['dine_in', 'takeaway'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`rounded-xl border py-3 text-sm font-semibold ${
                    orderType === type
                      ? 'border-brand-primary bg-brand-primary text-on-brand'
                      : 'border-line bg-bg-card'
                  }`}
                >
                  {type === 'dine_in' ? 'Eat in' : 'Takeaway'}
                </button>
              ))}
            </div>
          )}

          {hasAlcohol ? (
            <label className="flex items-start gap-3 rounded-xl border border-line bg-bg-card px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
              />
              <span>I confirm I am of legal drinking age.</span>
            </label>
          ) : null}

          {error ? <p className="rounded-xl bg-status-error/10 px-4 py-3 text-sm text-status-error">{error}</p> : null}
        </div>
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg-secondary/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto w-full max-w-lg">
            <div className="mb-3 flex justify-between">
              <span>Total</span>
              <span className="font-mono font-bold text-brand-primary">{formatPrice(total)}</span>
            </div>
            <button
              type="button"
              disabled={lines.length === 0 || placeMutation.isPending}
              onClick={tryPlace}
              className="h-12 w-full rounded-xl bg-brand-primary font-bold text-on-brand disabled:opacity-40"
            >
              {placeMutation.isPending
                ? 'Sending order…'
                : isTableFlow
                  ? 'Send order · Pay at table'
                  : 'Send order · Pay at counter'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      {banner}
      <header className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
        {data.logoUrl ? (
          <img src={data.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <BrandWordmark size="sm" showMark />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">
            {data.organizationName}
          </p>
          <h1 className="truncate font-display text-lg font-bold">{data.outletName}</h1>
          {tableName ? <p className="text-xs text-text-secondary">Table {tableName}</p> : null}
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3">
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

      <main className="mx-auto w-full max-w-lg flex-1 space-y-2 px-4 pb-28">
        {items.length === 0 ? (
          <p className="py-16 text-center text-text-muted">No items available right now.</p>
        ) : (
          items.map((item) => {
            const inCart = lines.filter((l) => l.menuItemId === item.id).reduce((s, l) => s + l.quantity, 0);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemTap(item)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-bg-card p-3 text-left"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg-elevated">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">
                    {item.isVeg != null ? (
                      <span
                        aria-label={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                        className={`mr-2 inline-block h-2.5 w-2.5 rounded-sm border-2 align-middle ${
                          item.isVeg ? 'border-green-500 bg-green-500/40' : 'border-red-500 bg-red-500/40'
                        }`}
                      />
                    ) : null}
                    {item.name}
                  </p>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{item.description}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-sm font-bold text-brand-primary">{formatPrice(item.price)}</p>
                </div>
                {inCart > 0 ? (
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-primary px-2 font-mono text-sm font-bold text-on-brand">
                    {inCart}
                  </span>
                ) : (
                  <span className="text-xl text-brand-primary" aria-hidden>
                    +
                  </span>
                )}
              </button>
            );
          })
        )}
      </main>

      {itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg-secondary/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button
            type="button"
            onClick={() => setStep('cart')}
            className="mx-auto flex h-12 w-full max-w-lg items-center justify-between rounded-xl bg-brand-primary px-4 font-bold text-on-brand"
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
            isAlcohol: Boolean(selectedItem.isAlcohol),
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
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold ${
        active ? 'bg-brand-primary text-on-brand' : 'border border-line bg-bg-card text-text-secondary'
      }`}
    >
      {label}
    </button>
  );
}

function QtyButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated text-xl"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-11 rounded-xl bg-brand-primary px-6 font-bold text-on-brand">
      Try again
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

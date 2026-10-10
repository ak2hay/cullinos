import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BrandWordmark, PhoneField } from '@cullinos/ui';
import { AppBanner } from '@/components/AppBanner';
import { ModifierModal, type ModifierSelection } from '@/components/ModifierModal';
import { CartDock } from '@/components/menu/CartDock';
import { CategoryRail } from '@/components/menu/CategoryRail';
import { DishCard } from '@/components/menu/DishCard';
import { MenuHero } from '@/components/menu/MenuHero';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  FlameIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
} from '@/components/menu/icons';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fullMenuRef = useRef<HTMLDivElement>(null);

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
  const popularIds = useMemo(() => new Set(data?.popularItemIds ?? []), [data?.popularItemIds]);
  const popularItems = useMemo(
    () =>
      (data?.popularItemIds ?? [])
        .map((id) => availableItems.find((i) => i.id === id))
        .filter((i): i is MenuItem => Boolean(i)),
    [data?.popularItemIds, availableItems],
  );
  const searchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(
    () =>
      searchTerm
        ? availableItems.filter(
            (i) =>
              i.name.toLowerCase().includes(searchTerm) ||
              (i.description ?? '').toLowerCase().includes(searchTerm),
          )
        : [],
    [availableItems, searchTerm],
  );
  const sections = useMemo(() => {
    const cats = categoryId ? visibleCategories.filter((c) => c.id === categoryId) : visibleCategories;
    const grouped = cats.map((c) => ({
      id: c.id,
      name: c.name,
      items: availableItems.filter((i) => i.categoryId === c.id),
    }));
    if (!categoryId) {
      const known = new Set(visibleCategories.map((c) => c.id));
      const other = availableItems.filter((i) => !i.categoryId || !known.has(i.categoryId));
      if (other.length) grouped.push({ id: 'other', name: 'More', items: other });
    }
    return grouped;
  }, [availableItems, visibleCategories, categoryId]);

  const qtyByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) map.set(l.menuItemId, (map.get(l.menuItemId) ?? 0) + l.quantity);
    return map;
  }, [lines]);

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const hasAlcohol = lines.some((l) => l.isAlcohol);
  const nameError = submitted && !guestName.trim() ? 'Enter your name' : '';
  const phoneFieldError = submitted ? phoneError(phone) ?? '' : '';

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

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

  function removeOne(item: MenuItem) {
    const last = [...lines].reverse().find((l) => l.menuItemId === item.id);
    if (last) updateQty(last.key, last.quantity - 1);
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
          customerPhone: phone,
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
        customerPhone: phone,
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
      <div className="qr-light min-h-screen">
        {banner}
        <main className="mx-auto flex max-w-md flex-col items-center gap-5 px-5 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-qr-yellow-soft text-qr-yellow-deep">
            <SparkIcon size={30} />
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-qr-yellow-deep">{data.outletName}</p>
          <h1 className="font-display text-3xl font-extrabold">Order placed</h1>
          <p className="text-text-secondary">
            {tableName
              ? `We'll send this to the kitchen for table ${tableName}. Pay at the table.`
              : 'Show this at the counter to pay.'}
          </p>
          <div className="w-full rounded-2xl bg-bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-text-muted">Order number</p>
            <p className="font-display text-4xl font-black tracking-wide text-qr-ink">{placed.orderNumber}</p>
            {placed.pickupCode ? (
              <p className="mt-1 text-sm text-text-secondary">
                Pickup code <span className="font-mono font-bold text-text-primary">{placed.pickupCode}</span>
              </p>
            ) : null}
            <ul className="mt-4 space-y-1.5 border-t border-line-subtle pt-4 text-left text-sm text-text-secondary">
              {receiptLines.map((line) => (
                <li key={line.key} className="flex justify-between gap-4">
                  <span>
                    {line.quantity}× {line.name}
                    {line.variantName ? ` (${line.variantName})` : ''}
                  </span>
                  <span className="font-semibold text-text-primary">{formatPrice(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="rounded-2xl bg-qr-yellow-soft px-4 py-3 text-sm text-qr-ink">
            Loyalty points will be added to <span className="font-semibold">{phone}</span> once the bill is paid.
          </p>
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
            className="h-12 w-full rounded-2xl bg-qr-ink font-display font-bold text-white"
          >
            Order something else
          </button>
        </main>
      </div>
    );
  }

  if (step === 'cart') {
    return (
      <div className="qr-light flex min-h-screen flex-col">
        {banner}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-bg-primary/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setStep('menu')}
            aria-label="Back to menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-card shadow-sm"
          >
            <ArrowLeftIcon size={18} />
          </button>
          <div>
            <h1 className="font-display text-lg font-extrabold leading-tight">Your cart</h1>
            <p className="text-xs text-text-muted">
              {data.outletName}
              {tableName ? ` · Table ${tableName}` : ''}
            </p>
          </div>
        </header>
        <div className="mx-auto w-full max-w-md flex-1 space-y-3 px-4 pb-44 pt-1">
          {lines.length === 0 ? <p className="py-10 text-center text-text-muted">Your cart is empty.</p> : null}
          {lines.map((line) => (
            <div key={line.key} className="flex items-center justify-between gap-3 rounded-2xl bg-bg-card p-3 shadow-sm">
              <div className="min-w-0">
                <p className="font-display font-bold">
                  {line.name}
                  {line.variantName ? (
                    <span className="text-sm font-normal text-text-muted"> · {line.variantName}</span>
                  ) : null}
                </p>
                {line.modifiers.length ? (
                  <p className="truncate text-xs text-text-muted">{line.modifiers.map((m) => m.name).join(', ')}</p>
                ) : null}
                <p className="mt-0.5 font-display text-sm font-extrabold text-qr-yellow-deep">
                  {formatPrice(line.unitPrice * line.quantity)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl bg-qr-yellow-soft p-1">
                <QtyButton label={`Remove one ${line.name}`} onClick={() => updateQty(line.key, line.quantity - 1)}>
                  <MinusIcon size={16} />
                </QtyButton>
                <span className="min-w-[1.25rem] text-center font-display font-bold">{line.quantity}</span>
                <QtyButton label={`Add one ${line.name}`} onClick={() => updateQty(line.key, line.quantity + 1)}>
                  <PlusIcon size={16} />
                </QtyButton>
              </div>
            </div>
          ))}

          <section className="space-y-3 rounded-2xl bg-bg-card p-4 shadow-sm">
            <h2 className="font-display font-bold">Your details</h2>
            <div>
              <label className="mb-1 block text-sm font-semibold text-text-secondary" htmlFor="guest-name">
                Name
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                maxLength={60}
                autoComplete="name"
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-3 outline-none focus:border-qr-yellow"
                placeholder="Your name"
              />
              {nameError ? <p className="mt-1 text-sm text-status-error">{nameError}</p> : null}
            </div>

            <PhoneField label="Phone" value={phone} onChange={setPhone} required error={phoneFieldError || undefined} />
            <p className="flex items-start gap-2 rounded-xl bg-qr-yellow-soft px-3 py-2 text-xs text-qr-ink">
              <SparkIcon size={14} className="mt-0.5 shrink-0 text-qr-yellow-deep" />
              Earn loyalty points on this order. They're added to this phone number once the bill is paid.
            </p>

            <div>
              <label className="mb-1 block text-sm font-semibold text-text-secondary" htmlFor="order-notes">
                Note for the kitchen
              </label>
              <textarea
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-3 outline-none focus:border-qr-yellow"
                placeholder="Optional"
              />
            </div>
          </section>

          {isTableFlow ? (
            <p className="rounded-2xl bg-bg-card px-4 py-3 text-sm text-text-secondary shadow-sm">
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
                  className={`rounded-2xl py-3 text-sm font-semibold shadow-sm ${
                    orderType === type ? 'bg-qr-yellow text-qr-ink' : 'bg-bg-card'
                  }`}
                >
                  {type === 'dine_in' ? 'Eat in' : 'Takeaway'}
                </button>
              ))}
            </div>
          )}

          {hasAlcohol ? (
            <label className="flex items-start gap-3 rounded-2xl bg-bg-card px-4 py-3 text-sm shadow-sm">
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
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-[22px] bg-qr-ink p-2 pl-4 text-white shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/60">Total</p>
              <p className="font-display text-lg font-extrabold">{formatPrice(total)}</p>
            </div>
            <button
              type="button"
              disabled={lines.length === 0 || placeMutation.isPending}
              onClick={tryPlace}
              className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-qr-yellow px-5 font-display text-[15px] font-bold text-qr-ink disabled:opacity-40"
            >
              {placeMutation.isPending ? 'Sending…' : isTableFlow ? 'Send to kitchen' : 'Place Order'}
              {placeMutation.isPending ? null : <ArrowRightIcon size={18} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showPopular = !categoryId && !searchTerm && popularItems.length > 0;

  return (
    <div className="qr-light flex min-h-screen flex-col">
      {banner}
      <div className="mx-auto w-full max-w-md">
        <MenuHero data={data} tableName={tableName} onSearch={() => setSearchOpen(true)} />

        <div className="sticky top-0 z-20 -mt-3 rounded-t-3xl bg-bg-primary">
          {searchOpen ? (
            <div className="px-4 pt-3">
              <label className="flex h-12 items-center gap-2 rounded-2xl bg-bg-card px-4 shadow-sm">
                <SearchIcon size={18} className="text-text-muted" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search dishes"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => {
                    setSearch('');
                    setSearchOpen(false);
                  }}
                  className="text-text-muted"
                >
                  <CloseIcon size={18} />
                </button>
              </label>
            </div>
          ) : null}
          {!searchTerm ? (
            <CategoryRail categories={visibleCategories} activeId={categoryId} onSelect={setCategoryId} />
          ) : null}
        </div>

        <main className="space-y-7 px-4 pb-32 pt-2">
          {searchTerm ? (
            <MenuSection title={`Results for "${search.trim()}"`} subtitle={`${searchResults.length} dishes`}>
              {searchResults.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">No dishes match your search.</p>
              ) : (
                searchResults.map((item) => renderCard(item))
              )}
            </MenuSection>
          ) : (
            <>
              {showPopular ? (
                <MenuSection
                  title="Popular Picks"
                  subtitle="Most ordered dishes at our restaurant"
                  icon={<FlameIcon size={22} className="text-orange-500" />}
                  action={
                    <button
                      type="button"
                      onClick={() => fullMenuRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      className="flex h-9 items-center gap-1.5 rounded-full border border-qr-yellow/50 bg-qr-yellow-soft px-4 text-sm font-semibold text-qr-yellow-deep"
                    >
                      View all
                      <ArrowRightIcon size={15} />
                    </button>
                  }
                >
                  {popularItems.map((item) => renderCard(item))}
                </MenuSection>
              ) : null}

              <div ref={fullMenuRef} className="scroll-mt-20 space-y-7">
                {sections.length === 0 ? (
                  <p className="py-16 text-center text-text-muted">No items available right now.</p>
                ) : (
                  sections.map((section) => (
                    <MenuSection
                      key={section.id}
                      title={section.name}
                      subtitle={`${section.items.length} ${section.items.length === 1 ? 'dish' : 'dishes'}`}
                    >
                      {section.items.map((item) => renderCard(item))}
                    </MenuSection>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {itemCount > 0 ? <CartDock itemCount={itemCount} total={total} onOpen={() => setStep('cart')} /> : null}

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

  function renderCard(item: MenuItem) {
    return (
      <DishCard
        key={item.id}
        item={item}
        quantity={qtyByItem.get(item.id) ?? 0}
        bestseller={popularIds.has(item.id)}
        onAdd={() => handleItemTap(item)}
        onRemove={() => removeOne(item)}
      />
    );
  }
}

function MenuSection({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? <span className="mt-0.5">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-extrabold">{title}</h2>
            {subtitle ? <p className="text-xs text-text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
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
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-qr-yellow-deep shadow-sm"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-11 rounded-2xl bg-qr-yellow px-6 font-bold text-qr-ink">
      Try again
    </button>
  );
}

function FullMessage({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="qr-light flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <BrandWordmark size="lg" />
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      {body ? <p className="max-w-md text-text-secondary">{body}</p> : null}
      {action}
    </div>
  );
}

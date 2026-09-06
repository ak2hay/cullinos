import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartSidebar, type PosCustomer } from '@/components/pos/CartSidebar';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { HeldOrdersPanel } from '@/components/pos/HeldOrdersPanel';
import { ItemGrid } from '@/components/pos/ItemGrid';
import { KeyboardHints } from '@/components/pos/KeyboardHints';
import { SearchBar } from '@/components/pos/SearchBar';
import {
  CULLINOS_BRAND,
  customersApi,
  loyaltyApi,
  menuApi,
  ordersApi,
  outletsApi,
  paymentsApi,
  posApi,
} from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';
import { generateIdempotencyKey } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { useHeldOrdersStore, type HeldOrder } from '@/stores/heldOrders';

const RECENT_KEY = 'cullinos.pos.recentItemIds';

function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecentId(id: string) {
  const next = [id, ...loadRecentIds().filter((x) => x !== id)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function PosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);

  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clear);
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotal);

  const heldOrders = useHeldOrdersStore((s) => s.orders);
  const addHeld = useHeldOrdersStore((s) => s.addHeld);
  const removeHeld = useHeldOrdersStore((s) => s.removeHeld);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [heldPanelOpen, setHeldPanelOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [linkedCustomer, setLinkedCustomer] = useState<PosCustomer | null>(null);
  const [orderType, setOrderType] = useState<'takeaway' | 'dine_in'>('takeaway');
  const [tipAmount, setTipAmount] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [unpaidOrder, setUnpaidOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentIds());
  const redeemAppliedOrderId = useRef<string | null>(null);

  const outletsQuery = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  const selectedOutlet = outletsQuery.data?.find((o) => o.id === outletId);
  const counterMode =
    selectedOutlet?.operatingMode === 'counter' || selectedOutlet?.operatingMode === 'hybrid';

  const menuQuery = useQuery({
    queryKey: ['menu', outletId],
    queryFn: () => menuApi.getOutletMenu(outletId!),
    enabled: Boolean(outletId),
  });

  useEffect(() => {
    if (!outletId && outletsQuery.data?.length) {
      setSelectedOutlet(outletsQuery.data[0].id);
    }
  }, [outletId, outletsQuery.data, setSelectedOutlet]);

  const quantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of lines) map[line.menuItemId] = line.quantity;
    return map;
  }, [lines]);

  const filteredItems = useMemo(() => {
    const items = menuQuery.data?.items ?? [];
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = !selectedCategoryId || item.categoryId === selectedCategoryId;
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch && item.isAvailable;
    });
  }, [menuQuery.data?.items, selectedCategoryId, search]);

  const recentItems = useMemo(() => {
    const items = menuQuery.data?.items ?? [];
    return recentIds
      .map((id) => items.find((i) => i.id === id && i.isAvailable))
      .filter((i): i is NonNullable<typeof i> => Boolean(i))
      .slice(0, 6);
  }, [menuQuery.data?.items, recentIds]);

  const createOrder = useCallback(async () => {
    if (!outletId || lines.length === 0) throw new Error('Cart is empty');
    const items = lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
    const key = generateIdempotencyKey();
    const payload = {
      outletId,
      items,
      autoConfirm: true,
      type: counterMode ? orderType : undefined,
      customerId: linkedCustomer?.id,
      customerName: customerName || linkedCustomer?.name || undefined,
      tipAmount: tipAmount || undefined,
      notes: counterMode
        ? `Counter order · ${orderType === 'takeaway' ? 'Pickup' : 'Eat in'}`
        : undefined,
    };
    try {
      return await posApi.quickOrder(payload, key);
    } catch {
      return ordersApi.create(
        { outletId, source: 'POS', items, customerId: linkedCustomer?.id },
        key,
      );
    }
  }, [outletId, lines, counterMode, orderType, customerName, tipAmount, linkedCustomer]);

  const resetCustomer = useCallback(() => {
    setCustomerName('');
    setCustomerPhone('');
    setLinkedCustomer(null);
    setTipAmount(0);
    setRedeemPoints(0);
  }, []);

  const finishPaid = useCallback(
    (orderNumber: string, method: string) => {
      clearCart();
      resetCustomer();
      setUnpaidOrder(null);
      redeemAppliedOrderId.current = null;
      setStatusMessage(`Order #${orderNumber} paid · ${method}`);
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
    [clearCart, queryClient, resetCustomer],
  );

  const loyaltySettingsQuery = useQuery({
    queryKey: ['loyalty', 'settings'],
    queryFn: loyaltyApi.getSettings,
    enabled: Boolean(linkedCustomer),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (input: {
      tender: 'cash' | 'online';
      orderId?: string;
      orderNumber?: string;
    }) => {
      const settings = loyaltySettingsQuery.data;
      if (redeemPoints > 0) {
        if (!linkedCustomer) throw new Error('Link a customer to redeem points');
        if (!settings) throw new Error('Loyalty settings unavailable');
        if (redeemPoints < settings.minRedeem) {
          throw new Error(`Minimum ${settings.minRedeem} points to redeem`);
        }
        if (redeemPoints > linkedCustomer.loyaltyPoints) {
          throw new Error('Not enough loyalty points');
        }
        const discountRupees = redeemPoints * settings.redemptionValue;
        const cartRupees = subtotal() / 100 + (tipAmount || 0);
        if (discountRupees > cartRupees) {
          throw new Error('Loyalty discount cannot exceed order total');
        }
      }

      const order = input.orderId
        ? { id: input.orderId, orderNumber: input.orderNumber ?? input.orderId }
        : await createOrder();

      if (
        linkedCustomer &&
        redeemPoints > 0 &&
        redeemAppliedOrderId.current !== order.id
      ) {
        try {
          const result = await loyaltyApi.redeem(
            linkedCustomer.id,
            redeemPoints,
            order.id,
          );
          redeemAppliedOrderId.current = order.id;
          setLinkedCustomer((c) =>
            c ? { ...c, loyaltyPoints: result.remainingPoints } : c,
          );
          setRedeemPoints(0);
        } catch (err) {
          setUnpaidOrder({ id: order.id, orderNumber: order.orderNumber });
          throw err instanceof Error ? err : new Error('Loyalty redeem failed');
        }
      }

      if (input.tender === 'cash') {
        await paymentsApi.payCash(order.id);
        return { order, method: 'Cash' };
      }

      const intent = await paymentsApi.createIntent(order.id);
      const key = intent.keyId ?? import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Razorpay key is not configured');
      try {
        const result = await openRazorpayCheckout({
          key,
          amountPaise: intent.amountPaise,
          currency: intent.currency,
          razorpayOrderId: intent.razorpayOrderId,
          description: `Order #${order.orderNumber}`,
        });
        await paymentsApi.verify({
          razorpayOrderId: result.razorpay_order_id,
          razorpayPaymentId: result.razorpay_payment_id,
          razorpaySignature: result.razorpay_signature,
        });
        return { order, method: 'UPI / card' };
      } catch (err) {
        setUnpaidOrder({ id: order.id, orderNumber: order.orderNumber });
        if (!input.orderId) {
          clearCart();
          resetCustomer();
        }
        throw err;
      }
    },
    onSuccess: ({ order, method }) => {
      finishPaid(order.orderNumber, method);
    },
    onError: (err) => {
      setStatusMessage(err instanceof Error ? err.message : 'Checkout failed');
    },
  });

  const holdMutation = useMutation({
    mutationFn: async () => {
      if (!outletId || lines.length === 0) throw new Error('Cart is empty');
      const items = lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
      const key = generateIdempotencyKey();
      let order;
      try {
        order = await posApi.quickOrder({ outletId, items, autoConfirm: false }, key);
        order = await posApi.holdOrder(order.id);
      } catch {
        order = await ordersApi.create({ outletId, source: 'POS', items }, key);
        order = await ordersApi.hold(order.id);
      }
      return order;
    },
    onSuccess: (order) => {
      addHeld({
        id: order.id,
        orderNumber: order.orderNumber,
        heldAt: new Date().toISOString(),
        lines: [...lines],
        subtotal: subtotal(),
      });
      clearCart();
      setStatusMessage(`Order ${order.orderNumber} held`);
    },
    onError: (err) => {
      setStatusMessage(err instanceof Error ? err.message : 'Hold failed');
    },
  });

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const q = customerPhone.trim();
      if (!q) throw new Error('Enter a phone number');
      const matches = await customersApi.search(q);
      const exact =
        matches.find((c) => c.phone?.replace(/\D/g, '').endsWith(q.replace(/\D/g, ''))) ??
        matches[0];
      if (exact) return exact;
      const name = customerName.trim() || `Guest ${q.slice(-4)}`;
      return customersApi.create({ name, phone: q });
    },
    onSuccess: (customer) => {
      setLinkedCustomer(customer);
      if (customer.name) setCustomerName(customer.name);
      setRedeemPoints(0);
      setStatusMessage(
        `${customer.name} · ${customer.loyaltyPoints} loyalty points`,
      );
    },
    onError: (err) => {
      setStatusMessage(err instanceof Error ? err.message : 'Customer lookup failed');
    },
  });

  const rewardsQuery = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: loyaltyApi.listRewards,
    enabled: Boolean(linkedCustomer),
  });

  const redeemRewardMutation = useMutation({
    mutationFn: (rewardId: string) => {
      if (!linkedCustomer) throw new Error('Link a customer first');
      return loyaltyApi.redeemReward(linkedCustomer.id, rewardId);
    },
    onSuccess: (result) => {
      setLinkedCustomer((c) =>
        c ? { ...c, loyaltyPoints: result.remainingPoints } : c,
      );
      if (result.freeMenuItem) {
        addItem({
          id: result.freeMenuItem.id,
          name: `${result.freeMenuItem.name} (reward)`,
          price: 0,
        });
      }
      setStatusMessage(`Redeemed ${result.reward.name} (−${result.reward.pointsCost} pts)`);
      queryClient.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: (err) => {
      setStatusMessage(err instanceof Error ? err.message : 'Redeem failed');
    },
  });

  const affordableRewards = useMemo(() => {
    const points = linkedCustomer?.loyaltyPoints ?? 0;
    return (rewardsQuery.data ?? [])
      .filter((r) => r.isActive)
      .map((r) => ({
        id: r.id,
        name: r.name,
        pointsCost: r.pointsCost,
        affordable: points >= r.pointsCost,
      }));
  }, [rewardsQuery.data, linkedCustomer?.loyaltyPoints]);

  const resumeHeld = useCallback(
    async (held: HeldOrder) => {
      try {
        await posApi.resumeOrder(held.id).catch(() => ordersApi.resume(held.id));
        useCartStore.setState({ lines: held.lines });
        removeHeld(held.id);
        setHeldPanelOpen(false);
        setStatusMessage(`Resumed ${held.orderNumber}`);
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : 'Resume failed');
      }
    },
    [removeHeld],
  );

  const handleCash = useCallback(() => {
    if (!checkoutMutation.isPending && lines.length > 0) {
      checkoutMutation.mutate({ tender: 'cash' });
    }
  }, [checkoutMutation, lines.length]);

  const handleOnline = useCallback(() => {
    if (!checkoutMutation.isPending && lines.length > 0) {
      checkoutMutation.mutate({ tender: 'online' });
    }
  }, [checkoutMutation, lines.length]);

  const handleHold = useCallback(() => {
    if (!holdMutation.isPending && lines.length > 0) {
      holdMutation.mutate();
    }
  }, [holdMutation, lines.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (isInput && e.key !== 'Escape') return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCash();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleHold();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clearCart();
        setStatusMessage('Cart cleared');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCash, handleHold, clearCart]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleAddItem(item: { id: string; name: string; price: number }) {
    addItem(item);
    setRecentIds(pushRecentId(item.id));
    setStatusMessage(`Added ${item.name}`);
  }

  const emptyMenu = !menuQuery.isLoading && (menuQuery.data?.items?.length ?? 0) === 0;

  return (
    <div className="flex h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--color-bg-secondary)_0%,_var(--color-bg-primary)_55%)]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-bg-secondary/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary font-mono font-bold text-bg-primary shadow-md shadow-brand-primary/30">
            C
          </div>
          <div>
            <p className="font-semibold tracking-tight">{CULLINOS_BRAND.name} POS</p>
            <p className="text-xs text-text-muted">
              {user?.firstName} {user?.lastName}
              {selectedOutlet ? ` · ${selectedOutlet.name}` : ''}
            </p>
          </div>
        </div>

        <div className="hidden flex-1 px-4 md:block">
          <SearchBar ref={searchRef} value={search} onChange={setSearch} />
        </div>

        <div className="flex items-center gap-3">
          <KeyboardHints />
          <select
            value={outletId ?? ''}
            onChange={(e) => setSelectedOutlet(e.target.value || null)}
            className="h-10 rounded-xl border border-white/10 bg-bg-elevated px-3 text-sm"
          >
            {(outletsQuery.data ?? []).map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <HeldOrdersPanel
              orders={heldOrders}
              onResume={resumeHeld}
              onDismiss={removeHeld}
              open={heldPanelOpen}
              onToggle={() => setHeldPanelOpen((v) => !v)}
            />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="border-b border-white/5 px-4 py-2 md:hidden">
        <SearchBar ref={searchRef} value={search} onChange={setSearch} />
      </div>

      {statusMessage ? (
        <div className="animate-[fadeIn_0.2s_ease] bg-brand-primary/15 px-4 py-2 text-center text-sm font-medium text-brand-primary">
          {statusMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
          {menuQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center text-text-muted">
              Loading menu…
            </div>
          ) : menuQuery.error ? (
            <div className="flex flex-1 items-center justify-center text-status-error">
              {menuQuery.error instanceof Error ? menuQuery.error.message : 'Failed to load menu'}
            </div>
          ) : emptyMenu ? (
            <ItemGrid items={[]} onAdd={handleAddItem} emptyHint="No menu items yet." />
          ) : (
            <>
              <CategoryTabs
                categories={menuQuery.data?.categories ?? []}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
              {recentItems.length > 0 && !search && !selectedCategoryId ? (
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Recent
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recentItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddItem(item)}
                        className="shrink-0 rounded-full border border-white/10 bg-bg-card px-4 py-2 text-sm font-medium transition hover:border-brand-primary/40 active:scale-95"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ItemGrid
                  items={filteredItems}
                  quantities={quantities}
                  onAdd={handleAddItem}
                />
              </div>
            </>
          )}
        </main>

        <CartSidebar
          onCash={handleCash}
          onOnline={handleOnline}
          unpaidOrder={unpaidOrder}
          onRetryUnpaidCash={() =>
            unpaidOrder &&
            checkoutMutation.mutate({
              tender: 'cash',
              orderId: unpaidOrder.id,
              orderNumber: unpaidOrder.orderNumber,
            })
          }
          onRetryUnpaidOnline={() =>
            unpaidOrder &&
            checkoutMutation.mutate({
              tender: 'online',
              orderId: unpaidOrder.id,
              orderNumber: unpaidOrder.orderNumber,
            })
          }
          onHold={handleHold}
          onClear={() => {
            clearCart();
            setStatusMessage('Cart cleared');
          }}
          checkoutLoading={checkoutMutation.isPending}
          holdLoading={holdMutation.isPending}
          counterMode={counterMode}
          customerName={customerName}
          onCustomerNameChange={setCustomerName}
          customerPhone={customerPhone}
          onCustomerPhoneChange={setCustomerPhone}
          onLookupCustomer={() => lookupMutation.mutate()}
          customerLookupLoading={lookupMutation.isPending}
          linkedCustomer={linkedCustomer}
          onClearCustomer={() => {
            setLinkedCustomer(null);
            setCustomerPhone('');
            setRedeemPoints(0);
          }}
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          tipAmount={tipAmount}
          onTipChange={setTipAmount}
          rewards={affordableRewards}
          onRedeemReward={(id) => redeemRewardMutation.mutate(id)}
          redeemRewardLoading={redeemRewardMutation.isPending}
          redeemPoints={redeemPoints}
          onRedeemPointsChange={setRedeemPoints}
          loyaltySettings={
            loyaltySettingsQuery.data
              ? {
                  minRedeem: loyaltySettingsQuery.data.minRedeem,
                  redemptionValue: loyaltySettingsQuery.data.redemptionValue,
                }
              : null
          }
        />
      </div>
    </div>
  );
}

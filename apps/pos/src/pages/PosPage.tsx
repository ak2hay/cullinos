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
  feedbackApi,
  loyaltyApi,
  menuApi,
  ordersApi,
  outletsApi,
  paymentsApi,
  posApi,
} from '@/lib/api';
import { printReceipt, type PrintableOrder } from '@/lib/printHelper';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';
import { openCashfreeCheckout } from '@/lib/cashfree-checkout';
import { formatMoney, generateIdempotencyKey } from '@/lib/format';
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
  const [couponCode, setCouponCode] = useState('');
  const [manualDiscount, setManualDiscount] = useState(0);
  const [partialCashAmount, setPartialCashAmount] = useState<number | undefined>(undefined);
  const [unpaidOrder, setUnpaidOrder] = useState<{ id: string; orderNumber: string } | null>(
    null,
  );
  const [splitSelectIds, setSplitSelectIds] = useState<string[]>([]);
  const [ebillOrderId, setEbillOrderId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentIds());
  const [mobileView, setMobileView] = useState<'menu' | 'cart'>('menu');
  const redeemAppliedOrderId = useRef<string | null>(null);
  const prevLineCount = useRef(lines.length);
  const cartItemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  useEffect(() => {
    if (prevLineCount.current > 0 && lines.length === 0 && !unpaidOrder) {
      setMobileView('menu');
    }
    prevLineCount.current = lines.length;
  }, [lines.length, unpaidOrder]);

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

  const shiftQuery = useQuery({
    queryKey: ['pos', 'shift', outletId],
    queryFn: () => posApi.getOpenShift(outletId!),
    enabled: Boolean(outletId),
    refetchInterval: 60_000,
  });
  const openShift = shiftQuery.data as
    | { id: string; openedAt: string; openingCash: number; status: string }
    | null
    | undefined;
  const hasOpenShift = Boolean(openShift?.id);

  const gatewayStatusQuery = useQuery({
    queryKey: ['payments', 'gateway-status', outletId],
    queryFn: () => paymentsApi.gatewayStatus(outletId!),
    enabled: Boolean(outletId),
    staleTime: 60_000,
  });
  const onlineDisabledReason =
    gatewayStatusQuery.data?.onlineEnabled === false
      ? 'UPI/card is off: ask an admin to connect Razorpay or Cashfree in Settings → Payments.'
      : null;

  const unpaidBalanceQuery = useQuery({
    queryKey: ['pos', 'balance', unpaidOrder?.id],
    queryFn: () => paymentsApi.getBalance(unpaidOrder!.id),
    enabled: Boolean(unpaidOrder?.id),
    refetchInterval: 15_000,
  });

  const unpaidDetailQuery = useQuery({
    queryKey: ['pos', 'order', unpaidOrder?.id],
    queryFn: () => ordersApi.get(unpaidOrder!.id),
    enabled: Boolean(unpaidOrder?.id),
  });

  const openShiftMutation = useMutation({
    mutationFn: () => posApi.openShift(outletId!, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos', 'shift', outletId] });
      setStatusMessage('Shift opened');
    },
    onError: (err) =>
      setStatusMessage(err instanceof Error ? err.message : 'Could not open shift'),
  });

  const closeShiftMutation = useMutation({
    mutationFn: () => {
      if (!openShift?.id) throw new Error('No open shift');
      return posApi.closeShift(openShift.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos', 'shift', outletId] });
      setStatusMessage('Shift closed');
    },
    onError: (err) =>
      setStatusMessage(err instanceof Error ? err.message : 'Could not close shift'),
  });

  const splitMutation = useMutation({
    mutationFn: async () => {
      if (!unpaidOrder?.id || splitSelectIds.length === 0) {
        throw new Error('Select items to split');
      }
      return ordersApi.split(unpaidOrder.id, splitSelectIds);
    },
    onSuccess: (result) => {
      setUnpaidOrder({
        id: result.original.id,
        orderNumber: result.original.orderNumber,
      });
      setSplitSelectIds([]);
      setStatusMessage(
        `Split → #${result.split.orderNumber}. Remaining on #${result.original.orderNumber}`,
      );
      queryClient.invalidateQueries({ queryKey: ['pos', 'order', result.original.id] });
      queryClient.invalidateQueries({ queryKey: ['pos', 'balance', result.original.id] });
    },
    onError: (err) =>
      setStatusMessage(err instanceof Error ? err.message : 'Split failed'),
  });

  const ebillMutation = useMutation({
    mutationFn: (channel: 'email' | 'sms') => {
      if (!ebillOrderId) throw new Error('No order');
      return ordersApi.sendEbill(ebillOrderId, channel);
    },
    onSuccess: (_data, channel) => {
      setStatusMessage(`E-bill sent via ${channel}`);
      setEbillOrderId(null);
    },
    onError: (err) =>
      setStatusMessage(err instanceof Error ? err.message : 'E-bill failed'),
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
    (
      order: {
        id?: string;
        orderNumber: string;
        customerName?: string | null;
        notes?: string | null;
        subtotal?: number;
        totalAmount?: number;
        items?: Array<{
          name: string;
          quantity: number;
          unitPrice: number;
          notes?: string | null;
        }>;
      },
      method: string,
    ) => {
      clearCart();
      resetCustomer();
      setUnpaidOrder(null);
      setSplitSelectIds([]);
      setPartialCashAmount(undefined);
      redeemAppliedOrderId.current = null;
      setStatusMessage(`Order #${order.orderNumber} paid · ${method}`);
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['pos', 'shift', outletId] });
      if (order.id) setEbillOrderId(order.id);

      const printable: PrintableOrder = {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        notes: order.notes,
        subtotal: order.subtotal ?? 0,
        total: order.totalAmount ?? 0,
        items: (order.items ?? []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      };
      void (async () => {
        if (order.id) {
          try {
            const survey = await feedbackApi.surveyLink(order.id);
            printable.feedbackUrl = survey.url;
          } catch {
            /* optional */
          }
        }
        await printReceipt('kot', printable).catch(() => undefined);
        await printReceipt('receipt', printable).catch(() => undefined);
      })();
    },
    [clearCart, outletId, queryClient, resetCustomer],
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

      if (couponCode.trim() || manualDiscount > 0) {
        await ordersApi.applyDiscount(order.id, {
          couponCode: couponCode.trim() || undefined,
          discountAmount: manualDiscount > 0 ? manualDiscount : undefined,
          reason: manualDiscount > 0 ? 'POS manual discount' : undefined,
        });
      }

      if (input.tender === 'cash') {
        if (!hasOpenShift) {
          throw new Error('Open a cashier shift before taking cash');
        }
        const cashResult = await paymentsApi.payCash(order.id, partialCashAmount);
        if (cashResult.remaining != null && cashResult.remaining > 0) {
          setUnpaidOrder({ id: order.id, orderNumber: order.orderNumber });
          setPartialCashAmount(undefined);
          setStatusMessage(`Partial cash recorded. Remaining ₹${cashResult.remaining}`);
          clearCart();
          queryClient.invalidateQueries({ queryKey: ['pos', 'balance', order.id] });
          queryClient.invalidateQueries({ queryKey: ['pos', 'shift', outletId] });
          return { order, method: 'Cash (partial)', partial: true as const };
        }
        return { order, method: 'Cash', partial: false as const };
      }

      const bal = await paymentsApi.getBalance(order.id);
      const payAmount =
        partialCashAmount != null && partialCashAmount > 0
          ? Math.min(partialCashAmount, bal.remaining)
          : undefined;
      const intent = await paymentsApi.createIntent(order.id, payAmount);
      try {
        if (intent.provider === 'cashfree') {
          if (!intent.paymentSessionId || !intent.cashfreeOrderId) {
            throw new Error('Cashfree session is missing. Configure it in Settings → Payments.');
          }
          await openCashfreeCheckout({
            paymentSessionId: intent.paymentSessionId,
            cashfreeOrderId: intent.cashfreeOrderId,
            mode: intent.mode,
          });
          await paymentsApi.verify({
            provider: 'cashfree',
            cashfreeOrderId: intent.cashfreeOrderId,
          });
        } else {
          const key = intent.keyId;
          if (!key || !intent.razorpayOrderId) {
            throw new Error(
              'Razorpay is not configured. Add the Key ID in Settings → Payments.',
            );
          }
          const result = await openRazorpayCheckout({
            key,
            amountPaise: intent.amountPaise,
            currency: intent.currency,
            razorpayOrderId: intent.razorpayOrderId,
            description: `Order #${order.orderNumber}`,
          });
          await paymentsApi.verify({
            provider: 'razorpay',
            razorpayOrderId: result.razorpay_order_id,
            razorpayPaymentId: result.razorpay_payment_id,
            razorpaySignature: result.razorpay_signature,
          });
        }
        const after = await paymentsApi.getBalance(order.id);
        if (after.remaining > 0) {
          setUnpaidOrder({ id: order.id, orderNumber: order.orderNumber });
          setPartialCashAmount(undefined);
          setStatusMessage(`Partial UPI recorded. Remaining ₹${after.remaining}`);
          clearCart();
          return { order, method: 'UPI (partial)', partial: true as const };
        }
        return { order, method: 'UPI / card', partial: false as const };
      } catch (err) {
        setUnpaidOrder({ id: order.id, orderNumber: order.orderNumber });
        if (!input.orderId) {
          clearCart();
          resetCustomer();
        }
        throw err;
      }
    },
    onSuccess: ({ order, method, partial }) => {
      if (partial) return;
      finishPaid(order, method);
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
    if (!hasOpenShift) {
      setStatusMessage('Open a cashier shift before taking cash');
      return;
    }
    if (!checkoutMutation.isPending && (lines.length > 0 || unpaidOrder)) {
      checkoutMutation.mutate({
        tender: 'cash',
        ...(unpaidOrder
          ? { orderId: unpaidOrder.id, orderNumber: unpaidOrder.orderNumber }
          : {}),
      });
    }
  }, [checkoutMutation, lines.length, hasOpenShift, unpaidOrder]);

  const handleOnline = useCallback(() => {
    if (!checkoutMutation.isPending && (lines.length > 0 || unpaidOrder)) {
      checkoutMutation.mutate({
        tender: 'online',
        ...(unpaidOrder
          ? { orderId: unpaidOrder.id, orderNumber: unpaidOrder.orderNumber }
          : {}),
      });
    }
  }, [checkoutMutation, lines.length, unpaidOrder]);

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
    <div className="flex h-[100dvh] flex-col bg-[radial-gradient(ellipse_at_top,_var(--color-bg-secondary)_0%,_var(--color-bg-primary)_55%)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/5 bg-bg-secondary/90 px-3 py-2 backdrop-blur sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary font-mono font-bold text-bg-primary shadow-md shadow-brand-primary/30 sm:h-10 sm:w-10">
            C
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-tight">{CULLINOS_BRAND.name} POS</p>
            <p className="hidden truncate text-xs text-text-muted sm:block">
              {user?.firstName} {user?.lastName}
              {selectedOutlet ? ` · ${selectedOutlet.name}` : ''}
            </p>
          </div>
        </div>

        <div className="hidden flex-1 px-4 md:block">
          <SearchBar ref={searchRef} value={search} onChange={setSearch} />
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden lg:block">
            <KeyboardHints />
          </div>
          <select
            value={outletId ?? ''}
            onChange={(e) => setSelectedOutlet(e.target.value || null)}
            aria-label="Outlet"
            className="h-9 min-w-0 max-w-[9rem] rounded-xl border border-white/10 bg-bg-elevated px-2 text-sm sm:h-10 sm:max-w-none sm:px-3"
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
            className="shrink-0 rounded-xl border border-white/10 px-2.5 py-2 text-xs text-text-secondary hover:text-text-primary sm:px-3 sm:text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="border-b border-white/5 px-3 py-2 md:hidden">
        <SearchBar ref={searchRef} value={search} onChange={setSearch} />
      </div>

      {outletId ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 bg-bg-elevated/60 px-3 py-1.5 text-xs sm:gap-3 sm:px-4 sm:py-2 sm:text-sm">
          {hasOpenShift ? (
            <>
              <p className="min-w-0 truncate text-text-secondary">
                Shift open
                {openShift?.openedAt
                  ? ` · since ${new Date(openShift.openedAt).toLocaleTimeString()}`
                  : ''}
              </p>
              <button
                type="button"
                disabled={closeShiftMutation.isPending}
                onClick={() => closeShiftMutation.mutate()}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold transition hover:border-status-error/40"
              >
                {closeShiftMutation.isPending ? 'Closing…' : 'Close shift'}
              </button>
            </>
          ) : (
            <>
              <p className="min-w-0 truncate text-status-warning">No open shift — cash tender blocked</p>
              <button
                type="button"
                disabled={openShiftMutation.isPending}
                onClick={() => openShiftMutation.mutate()}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-bg-primary"
              >
                {openShiftMutation.isPending ? 'Opening…' : 'Open shift'}
              </button>
            </>
          )}
        </div>
      ) : null}

      {statusMessage ? (
        <div className="animate-[fadeIn_0.2s_ease] bg-brand-primary/15 px-4 py-2 text-center text-sm font-medium text-brand-primary">
          {statusMessage}
        </div>
      ) : null}

      {ebillOrderId ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-white/5 bg-bg-card px-4 py-2 text-sm">
          <span className="text-text-secondary">Send e-bill?</span>
          <button
            type="button"
            disabled={ebillMutation.isPending}
            onClick={() => ebillMutation.mutate('sms')}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold"
          >
            SMS
          </button>
          <button
            type="button"
            disabled={ebillMutation.isPending}
            onClick={() => ebillMutation.mutate('email')}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold"
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setEbillOrderId(null)}
            className="rounded-lg px-2 py-1 text-xs text-text-muted"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main
          className={`${
            mobileView === 'cart' ? 'hidden lg:flex' : 'flex'
          } min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4`}
        >
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

        {mobileView === 'menu' && (cartItemCount > 0 || unpaidOrder) ? (
          <div className="shrink-0 border-t border-white/5 bg-bg-secondary px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView('cart')}
              className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-brand-primary px-4 text-bg-primary shadow-lg active:scale-[0.99]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-bg-primary/20 px-2 font-mono">
                  {cartItemCount}
                </span>
                {cartItemCount === 1 ? 'item' : 'items'}
              </span>
              <span className="flex items-center gap-2 text-sm font-bold">
                {unpaidOrder && cartItemCount === 0 ? 'Pending payment' : formatMoney(subtotal())}
                <span aria-hidden="true">→</span>
                <span>View cart</span>
              </span>
            </button>
          </div>
        ) : null}

        <div
          className={`${
            mobileView === 'menu' ? 'hidden lg:flex' : 'flex'
          } min-h-0 w-full flex-1 flex-col lg:h-full lg:w-[26rem] lg:flex-none`}
        >
          <CartSidebar
            onBack={() => setMobileView('menu')}
            onCash={handleCash}
            onOnline={handleOnline}
            cashDisabled={!hasOpenShift}
            onlineDisabledReason={onlineDisabledReason}
            unpaidOrder={unpaidOrder}
            unpaidBalance={unpaidBalanceQuery.data ?? null}
            splitItems={(unpaidDetailQuery.data?.items ?? []).map((it) => ({
              id: it.id,
              name: it.name,
              quantity: it.quantity,
            }))}
            splitSelectedIds={splitSelectIds}
            onToggleSplitItem={(id) =>
              setSplitSelectIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            onSplit={() => splitMutation.mutate()}
            splitLoading={splitMutation.isPending}
            onRetryUnpaidCash={() =>
              unpaidOrder &&
              hasOpenShift &&
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
            couponCode={couponCode}
            onCouponCodeChange={setCouponCode}
            manualDiscount={manualDiscount}
            onManualDiscountChange={setManualDiscount}
            partialCashAmount={partialCashAmount}
            onPartialCashAmountChange={setPartialCashAmount}
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
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartSidebar } from '@/components/pos/CartSidebar';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { HeldOrdersPanel } from '@/components/pos/HeldOrdersPanel';
import { ItemGrid } from '@/components/pos/ItemGrid';
import { KeyboardHints } from '@/components/pos/KeyboardHints';
import { SearchBar } from '@/components/pos/SearchBar';
import { CULLINOS_BRAND, menuApi, ordersApi, outletsApi, posApi } from '@/lib/api';
import { generateIdempotencyKey } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { useHeldOrdersStore, type HeldOrder } from '@/stores/heldOrders';

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

  const outletsQuery = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

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

  const filteredItems = useMemo(() => {
    const items = menuQuery.data?.items ?? [];
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = !selectedCategoryId || item.categoryId === selectedCategoryId;
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch && item.isAvailable;
    });
  }, [menuQuery.data?.items, selectedCategoryId, search]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!outletId || lines.length === 0) throw new Error('Cart is empty');
      const items = lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
      const key = generateIdempotencyKey();
      try {
        return await posApi.quickOrder({ outletId, items, autoConfirm: true }, key);
      } catch {
        return ordersApi.create({ outletId, source: 'POS', items }, key);
      }
    },
    onSuccess: (order) => {
      clearCart();
      setStatusMessage(`Order ${order.orderNumber} created`);
      queryClient.invalidateQueries({ queryKey: ['menu'] });
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

  const handleCheckout = useCallback(() => {
    if (!checkoutMutation.isPending && lines.length > 0) {
      checkoutMutation.mutate();
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
        handleCheckout();
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
  }, [handleCheckout, handleHold, clearCart]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-bg-secondary px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary">
            C
          </div>
          <div>
            <p className="font-semibold">{CULLINOS_BRAND.name} POS</p>
            <p className="text-xs text-text-muted">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>

        <div className="flex-1 px-4">
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

      {statusMessage ? (
        <div className="bg-brand-primary/15 px-4 py-2 text-center text-sm text-brand-primary">
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
          ) : (
            <>
              <CategoryTabs
                categories={menuQuery.data?.categories ?? []}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ItemGrid
                  items={filteredItems}
                  onAdd={(item) => {
                    addItem(item);
                    setStatusMessage(`Added ${item.name}`);
                  }}
                />
              </div>
            </>
          )}
        </main>

        <CartSidebar
          onCheckout={handleCheckout}
          onHold={handleHold}
          onClear={() => {
            clearCart();
            setStatusMessage('Cart cleared');
          }}
          checkoutLoading={checkoutMutation.isPending}
          holdLoading={holdMutation.isPending}
        />
      </div>
    </div>
  );
}

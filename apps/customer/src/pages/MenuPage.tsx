import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { MenuItemCard } from '@/components/MenuItemCard';
import { ModifierModal } from '@/components/ModifierModal';
import { hasApiAccess, menuApi, tablesApi, type MenuItem } from '@/lib/api';
import { useCartStore } from '@/stores/cart';
import { useSessionStore } from '@/stores/session';

export function MenuPage() {
  const [searchParams] = useSearchParams();
  const initFromSearchParams = useSessionStore((s) => s.initFromSearchParams);
  const setTable = useSessionStore((s) => s.setTable);
  const outletId = useSessionStore((s) => s.outletId);
  const tableId = useSessionStore((s) => s.tableId);
  const addItem = useCartStore((s) => s.addItem);

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    initFromSearchParams(searchParams);
  }, [searchParams, initFromSearchParams]);

  useEffect(() => {
    if (!outletId || !tableId || !hasApiAccess()) return;
    tablesApi.list(outletId).then((tables) => {
      const table = tables.find((t) => t.id === tableId || t.qrCode === tableId);
      if (table) {
        setTable(table.id, table.name);
      }
    }).catch(() => {
      /* table name resolution is best-effort */
    });
  }, [outletId, tableId, setTable]);

  const { data: menu, isLoading, isError } = useQuery({
    queryKey: ['menu', outletId],
    queryFn: () => menuApi.getOutletMenu(outletId!),
    enabled: Boolean(outletId) && hasApiAccess(),
  });

  const categories = useMemo(() => {
    if (!menu) return [];
    return [
      { id: 'all', name: 'All' },
      ...menu.categories,
    ];
  }, [menu]);

  const filteredItems = useMemo(() => {
    if (!menu) return [];
    const available = menu.items.filter((i) => i.isAvailable);
    if (!activeCategory || activeCategory === 'all') return available;
    return available.filter((i) => i.categoryId === activeCategory);
  }, [menu, activeCategory]);

  function handleItemSelect(item: MenuItem) {
    const hasOptions =
      (item.modifierGroups?.length ?? 0) > 0 || (item.variants?.length ?? 0) > 0;
    if (hasOptions) {
      setSelectedItem(item);
    } else {
      addItem({
        menuItemId: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: item.price,
        modifiers: [],
      });
    }
  }

  return (
    <CustomerLayout>
      <div className="p-4">
        {!outletId ? (
          <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm">
            <p className="font-medium text-status-warning">Outlet not configured</p>
            <p className="mt-1 text-text-secondary">
              Add <code className="text-brand-primary">?outlet=YOUR_OUTLET_ID</code> to the URL or set{' '}
              <code className="text-brand-primary">VITE_OUTLET_ID</code> in your environment.
            </p>
          </div>
        ) : !hasApiAccess() ? (
          <div className="rounded-xl border border-white/10 bg-bg-card p-4 text-sm text-text-secondary">
            Set <code className="text-brand-primary">VITE_ORDER_TOKEN</code> with a service JWT to load the live menu and place orders.
          </div>
        ) : isLoading ? (
          <p className="py-12 text-center text-text-secondary">Loading menu…</p>
        ) : isError ? (
          <p className="py-12 text-center text-status-error">Could not load menu.</p>
        ) : (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id === 'all' ? null : cat.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    (activeCategory === cat.id) ||
                    (!activeCategory && cat.id === 'all')
                      ? 'bg-brand-primary text-bg-primary'
                      : 'bg-bg-card text-text-secondary'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredItems.map((item) => (
                <MenuItemCard key={item.id} item={item} onSelect={handleItemSelect} />
              ))}
              {filteredItems.length === 0 ? (
                <p className="py-8 text-center text-text-muted">No items in this category.</p>
              ) : null}
            </div>
          </>
        )}
      </div>

      <ModifierModal
        item={selectedItem}
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        onAdd={(payload) => {
          if (!selectedItem) return;
          addItem({
            menuItemId: selectedItem.id,
            name: selectedItem.name,
            quantity: payload.quantity,
            unitPrice: payload.unitPrice,
            variantId: payload.variantId,
            variantName: payload.variantName,
            modifiers: payload.modifiers,
            notes: payload.notes,
          });
        }}
      />
    </CustomerLayout>
  );
}

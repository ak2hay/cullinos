import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { MenuItemCard } from '@/components/MenuItemCard';
import { ModifierModal } from '@/components/ModifierModal';
import { hasApiAccess, menuApi, tablesApi } from '@/lib/api';
import { useCartStore } from '@/stores/cart';
import { useSessionStore } from '@/stores/session';
export function MenuPage() {
    const [searchParams] = useSearchParams();
    const initFromSearchParams = useSessionStore((s) => s.initFromSearchParams);
    const setTable = useSessionStore((s) => s.setTable);
    const outletId = useSessionStore((s) => s.outletId);
    const tableId = useSessionStore((s) => s.tableId);
    const addItem = useCartStore((s) => s.addItem);
    const [selectedItem, setSelectedItem] = useState(null);
    const [activeCategory, setActiveCategory] = useState(null);
    useEffect(() => {
        initFromSearchParams(searchParams);
    }, [searchParams, initFromSearchParams]);
    useEffect(() => {
        if (!outletId || !tableId || !hasApiAccess())
            return;
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
        queryFn: () => menuApi.getOutletMenu(outletId),
        enabled: Boolean(outletId) && hasApiAccess(),
    });
    const categories = useMemo(() => {
        if (!menu)
            return [];
        return [
            { id: 'all', name: 'All' },
            ...menu.categories,
        ];
    }, [menu]);
    const filteredItems = useMemo(() => {
        if (!menu)
            return [];
        const available = menu.items.filter((i) => i.isAvailable);
        if (!activeCategory || activeCategory === 'all')
            return available;
        return available.filter((i) => i.categoryId === activeCategory);
    }, [menu, activeCategory]);
    function handleItemSelect(item) {
        const hasOptions = (item.modifierGroups?.length ?? 0) > 0 || (item.variants?.length ?? 0) > 0;
        if (hasOptions) {
            setSelectedItem(item);
        }
        else {
            addItem({
                menuItemId: item.id,
                name: item.name,
                quantity: 1,
                unitPrice: item.price,
                modifiers: [],
            });
        }
    }
    return (_jsxs(CustomerLayout, { children: [_jsx("div", { className: "p-4", children: !outletId ? (_jsx("div", { className: "rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm", children: _jsx("p", { className: "font-medium text-status-warning", children: "Loading store\u2026" }) })) : isLoading ? (_jsx("p", { className: "py-12 text-center text-text-secondary", children: "Loading menu\u2026" })) : isError ? (_jsx("p", { className: "py-12 text-center text-status-error", children: "Could not load menu." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "mb-4 flex gap-2 overflow-x-auto pb-1", children: categories.map((cat) => (_jsx("button", { type: "button", onClick: () => setActiveCategory(cat.id === 'all' ? null : cat.id), className: `shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${(activeCategory === cat.id) ||
                                    (!activeCategory && cat.id === 'all')
                                    ? 'bg-brand-primary text-bg-primary'
                                    : 'bg-bg-card text-text-secondary'}`, children: cat.name }, cat.id))) }), _jsxs("div", { className: "space-y-3", children: [filteredItems.map((item) => (_jsx(MenuItemCard, { item: item, onSelect: handleItemSelect }, item.id))), filteredItems.length === 0 ? (_jsx("p", { className: "py-8 text-center text-text-muted", children: "No items in this category." })) : null] })] })) }), _jsx(ModifierModal, { item: selectedItem, open: Boolean(selectedItem), onClose: () => setSelectedItem(null), onAdd: (payload) => {
                    if (!selectedItem)
                        return;
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
                } })] }));
}

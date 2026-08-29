import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from './ui/Form';
export function MenuQuickAdd({ items, onAdd, loading }) {
    const [search, setSearch] = useState('');
    const filtered = items.filter((item) => item.isAvailable &&
        item.name.toLowerCase().includes(search.toLowerCase()));
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("input", { type: "search", placeholder: "Search menu\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "h-10 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm outline-none focus:border-brand-primary" }), _jsxs("div", { className: "max-h-64 space-y-2 overflow-y-auto", children: [filtered.map((item) => (_jsxs("button", { type: "button", disabled: loading, onClick: () => onAdd({
                            menuItemId: item.id,
                            quantity: 1,
                        }), className: "flex w-full items-center justify-between rounded-lg border border-white/5 bg-bg-elevated px-3 py-2.5 text-left transition hover:border-brand-primary/30 active:bg-bg-card disabled:opacity-50", children: [_jsx("span", { className: "text-sm font-medium", children: item.name }), _jsxs("span", { className: "text-sm text-brand-primary", children: ["\u20B9", (item.price / 100).toFixed(0)] })] }, item.id))), filtered.length === 0 ? (_jsx("p", { className: "py-4 text-center text-sm text-text-muted", children: "No items found" })) : null] }), _jsx("p", { className: "text-xs text-text-muted", children: "Tap an item to add to the order" })] }));
}
export function QuickAddBar({ items, onQuickAdd, loading }) {
    const [open, setOpen] = useState(false);
    return (_jsx("div", { className: "border-t border-white/10 bg-bg-secondary p-4", children: open ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-medium", children: "Quick add items" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setOpen(false), children: "Close" })] }), _jsx(MenuQuickAdd, { items: items, loading: loading, onAdd: (item) => {
                        onQuickAdd([item]);
                    } })] })) : (_jsx(Button, { className: "w-full", onClick: () => setOpen(true), children: "+ Quick add items" })) }));
}

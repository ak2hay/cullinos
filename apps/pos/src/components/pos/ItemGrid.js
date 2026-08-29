import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ItemGrid({ items, onAdd }) {
    if (items.length === 0) {
        return (_jsx("div", { className: "flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 p-12 text-text-muted", children: "No items in this category" }));
    }
    return (_jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", children: items.map((item) => (_jsxs("button", { type: "button", disabled: !item.isAvailable, onClick: () => onAdd({ id: item.id, name: item.name, price: item.price }), className: "flex min-h-[100px] flex-col items-start justify-between rounded-xl border border-white/10 bg-bg-card p-4 text-left transition active:scale-[0.98] hover:border-brand-primary/40 hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40", children: [_jsx("span", { className: "line-clamp-2 text-base font-semibold leading-tight", children: item.name }), _jsxs("span", { className: "mt-2 font-mono text-sm text-brand-primary", children: ["\u20B9", (item.price / 100).toFixed(0)] })] }, item.id))) }));
}

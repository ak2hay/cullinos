import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import { useCartStore } from '@/stores/cart';
import { useSessionStore } from '@/stores/session';
export function CustomerLayout({ children, showCart = true }) {
    const base = useStorefrontBase();
    const itemCount = useCartStore((s) => s.itemCount());
    const tableName = useSessionStore((s) => s.tableName);
    const outletName = useSessionStore((s) => s.outletName);
    const organizationName = useSessionStore((s) => s.organizationName);
    const orderMode = useSessionStore((s) => s.orderMode);
    const title = outletName ?? organizationName ?? 'Cullinos';
    return (_jsxs("div", { className: "flex min-h-screen flex-col bg-bg-primary", children: [_jsx("header", { className: "sticky top-0 z-10 border-b border-white/10 bg-bg-secondary/95 px-4 py-3 backdrop-blur", children: _jsxs("div", { className: "mx-auto flex max-w-lg items-center justify-between", children: [_jsxs("div", { children: [_jsx(Link, { to: base, className: "text-lg font-semibold text-brand-primary", children: title }), orderMode === 'dine-in' && tableName ? (_jsx("p", { className: "text-xs text-text-secondary", children: tableName })) : (_jsx("p", { className: "text-xs text-text-secondary", children: "Order online" }))] }), showCart ? (_jsxs(Link, { to: `${base}/cart`, className: "relative flex h-10 items-center rounded-lg bg-bg-card px-3 text-sm font-medium transition hover:bg-bg-elevated", children: ["Cart", itemCount > 0 ? (_jsx("span", { className: "ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-xs font-bold text-bg-primary", children: itemCount })) : null] })) : null] }) }), _jsx("main", { className: "mx-auto w-full max-w-lg flex-1", children: children }), _jsx(PoweredByFooter, {})] }));
}

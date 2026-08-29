import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Button } from '@/components/ui/Form';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import { formatPrice } from '@/lib/api';
import { useCartStore } from '@/stores/cart';
export function CartPage() {
    const navigate = useNavigate();
    const base = useStorefrontBase();
    const items = useCartStore((s) => s.items);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const removeItem = useCartStore((s) => s.removeItem);
    const total = useCartStore((s) => s.total());
    return (_jsx(CustomerLayout, { showCart: false, children: _jsxs("div", { className: "p-4", children: [_jsx("button", { type: "button", onClick: () => navigate(base), className: "mb-4 text-sm text-brand-primary", children: "\u2190 Back to menu" }), _jsx("h1", { className: "mb-4 text-xl font-semibold", children: "Your cart" }), items.length === 0 ? (_jsxs("div", { className: "rounded-xl border border-dashed border-white/20 p-8 text-center", children: [_jsx("p", { className: "text-text-secondary", children: "Your cart is empty." }), _jsx(Link, { to: base, className: "mt-3 inline-block text-sm text-brand-primary", children: "Browse menu" })] })) : (_jsxs(_Fragment, { children: [_jsx("ul", { className: "space-y-3", children: items.map((item) => {
                                const modTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
                                const lineTotal = (item.unitPrice + modTotal) * item.quantity;
                                return (_jsxs("li", { className: "rounded-xl border border-white/10 bg-bg-card p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: item.name }), item.variantName ? (_jsx("p", { className: "text-xs text-text-secondary", children: item.variantName })) : null, item.modifiers.length > 0 ? (_jsx("p", { className: "text-xs text-text-muted", children: item.modifiers.map((m) => m.name).join(', ') })) : null, item.notes ? (_jsx("p", { className: "text-xs text-status-warning", children: item.notes })) : null] }), _jsx("span", { className: "font-medium text-brand-primary", children: formatPrice(lineTotal) })] }), _jsxs("div", { className: "mt-3 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => updateQuantity(item.id, item.quantity - 1), className: "flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated", children: "\u2212" }), _jsx("span", { className: "w-6 text-center text-sm", children: item.quantity }), _jsx("button", { type: "button", onClick: () => updateQuantity(item.id, item.quantity + 1), className: "flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated", children: "+" })] }), _jsx("button", { type: "button", onClick: () => removeItem(item.id), className: "text-xs text-status-error", children: "Remove" })] })] }, item.id));
                            }) }), _jsxs("div", { className: "mt-6 flex items-center justify-between border-t border-white/10 pt-4", children: [_jsx("span", { className: "font-medium", children: "Total" }), _jsx("span", { className: "text-xl font-semibold text-brand-primary", children: formatPrice(total) })] }), _jsx(Button, { className: "mt-4 w-full", onClick: () => navigate(`${base}/checkout`), children: "Proceed to checkout" })] }))] }) }));
}

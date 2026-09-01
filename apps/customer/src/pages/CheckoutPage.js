import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Button, Input } from '@/components/ui/Form';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import { formatPrice, ordersApi } from '@/lib/api';
import { useCartStore } from '@/stores/cart';
import { useSessionStore } from '@/stores/session';
export function CheckoutPage() {
    const navigate = useNavigate();
    const base = useStorefrontBase();
    const items = useCartStore((s) => s.items);
    const total = useCartStore((s) => s.total());
    const clearCart = useCartStore((s) => s.clear);
    const organizationId = useSessionStore((s) => s.organizationId);
    const outletId = useSessionStore((s) => s.outletId);
    const tableId = useSessionStore((s) => s.tableId);
    const orderMode = useSessionStore((s) => s.orderMode);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [scheduledPickup, setScheduledPickup] = useState('');
    const [tipAmount, setTipAmount] = useState(0);
    const [payLater, setPayLater] = useState(true);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState('');
    const placeOrderMutation = useMutation({
        mutationFn: async () => {
            if (!outletId || !organizationId)
                throw new Error('Store not loaded');
            const orderNotes = [
                name && `Guest: ${name}`,
                phone && `Phone: ${phone}`,
                notes,
                payLater ? 'Payment: Pay later' : 'Payment: Pay now',
            ]
                .filter(Boolean)
                .join(' · ');
            return ordersApi.create({
                organizationId,
                outletId,
                source: orderMode === 'dine-in' ? 'QR' : 'ONLINE',
                tableId: tableId ?? undefined,
                customerName: name || undefined,
                scheduledPickupAt: scheduledPickup ? new Date(scheduledPickup).toISOString() : undefined,
                tipAmount: tipAmount || undefined,
                notes: orderNotes || undefined,
                items: items.map((item) => ({
                    menuItemId: item.menuItemId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    modifiers: item.modifiers.map((m) => ({
                        name: m.name,
                        price: m.price,
                        modifierId: m.id,
                    })),
                    notes: item.notes,
                })),
            });
        },
        onSuccess: (order) => {
            clearCart();
            setSuccess(order.orderNumber);
        },
        onError: (err) => {
            setError(err instanceof Error ? err.message : 'Order failed');
        },
    });
    if (items.length === 0 && !success) {
        navigate(`${base}/cart`);
        return null;
    }
    if (success) {
        return (_jsx(CustomerLayout, { showCart: false, children: _jsxs("div", { className: "p-8 text-center", children: [_jsx("div", { className: "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-ready/20 text-3xl", children: "\u2713" }), _jsx("h1", { className: "text-xl font-semibold", children: "Order placed!" }), _jsxs("p", { className: "mt-2 text-text-secondary", children: ["Order #", success, " has been sent to the kitchen."] }), payLater ? (_jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Pay at the counter when ready." })) : null, _jsx(Button, { className: "mt-6 w-full", onClick: () => navigate(base), children: "Order more" })] }) }));
    }
    return (_jsx(CustomerLayout, { showCart: false, children: _jsxs("div", { className: "p-4", children: [_jsx("button", { type: "button", onClick: () => navigate(`${base}/cart`), className: "mb-4 text-sm text-brand-primary", children: "\u2190 Back to cart" }), _jsx("h1", { className: "mb-4 text-xl font-semibold", children: "Checkout" }), error ? (_jsx("div", { className: "mb-4 rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error })) : null, _jsxs("form", { className: "space-y-4", onSubmit: (e) => {
                        e.preventDefault();
                        setError('');
                        placeOrderMutation.mutate();
                    }, children: [_jsx(Input, { label: "Name (optional)", value: name, onChange: (e) => setName(e.target.value), placeholder: "Your name" }), _jsx(Input, { label: "Phone (optional)", type: "tel", value: phone, onChange: (e) => setPhone(e.target.value), placeholder: "+91 \u2026" }), _jsx(Input, { label: "Order notes", value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Allergies, seating preference\u2026" }), _jsx(Input, { label: "Scheduled pickup (optional)", type: "datetime-local", value: scheduledPickup, onChange: (e) => setScheduledPickup(e.target.value) }), _jsx(Input, { label: "Tip (\u20B9, optional)", type: "number", min: 0, value: tipAmount || '', onChange: (e) => setTipAmount(Number(e.target.value) || 0) }), _jsxs("div", { className: "rounded-xl border border-white/10 bg-bg-card p-4", children: [_jsx("p", { className: "mb-3 text-sm font-medium", children: "Payment" }), _jsxs("label", { className: "flex cursor-pointer items-center gap-3", children: [_jsx("input", { type: "radio", checked: payLater, onChange: () => setPayLater(true), className: "accent-brand-primary" }), _jsx("span", { className: "text-sm", children: "Pay later at counter / table" })] }), _jsxs("label", { className: "mt-2 flex cursor-pointer items-center gap-3", children: [_jsx("input", { type: "radio", checked: !payLater, onChange: () => setPayLater(false), className: "accent-brand-primary" }), _jsx("span", { className: "text-sm", children: "Pay now (UPI / card)" })] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl bg-bg-elevated p-4", children: [_jsx("span", { className: "font-medium", children: "Total due" }), _jsx("span", { className: "text-xl font-semibold text-brand-primary", children: formatPrice(total) })] }), _jsx(Button, { type: "submit", className: "w-full", loading: placeOrderMutation.isPending, disabled: !outletId || !organizationId, children: payLater ? 'Place order · Pay later' : 'Place order & pay' })] })] }) }));
}

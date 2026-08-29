import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { inventoryApi, outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function StockTransferPage() {
    const queryClient = useQueryClient();
    const defaultOutletId = useAuthStore((s) => s.selectedOutletId);
    const brandId = useAuthStore((s) => s.selectedBrandId);
    const [fromOutletId, setFromOutletId] = useState(defaultOutletId ?? '');
    const [toOutletId, setToOutletId] = useState('');
    const [inventoryItemId, setInventoryItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [message, setMessage] = useState(null);
    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets', brandId],
        queryFn: () => outletsApi.list(brandId ?? undefined),
    });
    const { data: items = [] } = useQuery({
        queryKey: ['inventory', 'items'],
        queryFn: inventoryApi.listItems,
        retry: false,
    });
    const transferMutation = useMutation({
        mutationFn: inventoryApi.transfer,
        onSuccess: () => {
            setMessage('Stock transfer submitted successfully.');
            setQuantity('');
            setNotes('');
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
        onError: (err) => setMessage(err.message),
    });
    function handleSubmit(e) {
        e.preventDefault();
        setMessage(null);
        if (!fromOutletId || !toOutletId || !inventoryItemId || !quantity)
            return;
        if (fromOutletId === toOutletId) {
            setMessage('Source and destination outlets must differ.');
            return;
        }
        transferMutation.mutate({
            fromOutletId,
            toOutletId,
            inventoryItemId,
            quantity: Number(quantity),
            notes: notes || undefined,
        });
    }
    return (_jsxs("div", { className: "mx-auto max-w-2xl space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Stock transfer" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Move inventory between outlets in your network." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5 rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "From outlet" }), _jsxs("select", { required: true, value: fromOutletId, onChange: (e) => setFromOutletId(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary", children: [_jsx("option", { value: "", children: "Select outlet" }), outlets.map((o) => (_jsx("option", { value: o.id, children: o.name }, o.id)))] })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "To outlet" }), _jsxs("select", { required: true, value: toOutletId, onChange: (e) => setToOutletId(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary", children: [_jsx("option", { value: "", children: "Select outlet" }), outlets.map((o) => (_jsx("option", { value: o.id, children: o.name }, o.id)))] })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Inventory item" }), _jsxs("select", { required: true, value: inventoryItemId, onChange: (e) => setInventoryItemId(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary", children: [_jsx("option", { value: "", children: "Select item" }), items.map((item) => (_jsxs("option", { value: item.id, children: [item.name, item.sku ? ` (${item.sku})` : ''] }, item.id)))] })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Quantity" }), _jsx("input", { type: "number", required: true, min: "0.01", step: "0.01", value: quantity, onChange: (e) => setQuantity(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary" })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Notes (optional)" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), rows: 3, className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary" })] }), message ? (_jsx("p", { className: "rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm", children: message })) : null, _jsx("button", { type: "submit", disabled: transferMutation.isPending, className: "rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-bg-primary hover:bg-brand-primary-dark disabled:opacity-60", children: transferMutation.isPending ? 'Submitting…' : 'Submit transfer' })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/api';
import { Button } from './ui/Form';
export function ModifierModal({ item, open, onClose, onAdd }) {
    const [quantity, setQuantity] = useState(1);
    const [selectedVariantId, setSelectedVariantId] = useState();
    const [selectedModifiers, setSelectedModifiers] = useState([]);
    const [notes, setNotes] = useState('');
    useEffect(() => {
        if (item) {
            setQuantity(1);
            setSelectedVariantId(item.variants?.[0]?.id);
            setSelectedModifiers([]);
            setNotes('');
        }
    }, [item]);
    if (!open || !item)
        return null;
    const variant = item.variants?.find((v) => v.id === selectedVariantId);
    const unitPrice = variant?.price ?? item.price;
    const modTotal = selectedModifiers.reduce((s, m) => s + m.price, 0);
    const lineTotal = (unitPrice + modTotal) * quantity;
    function toggleModifier(mod, groupMax, groupSelected) {
        const exists = selectedModifiers.some((m) => m.id === mod.id);
        if (exists) {
            setSelectedModifiers((prev) => prev.filter((m) => m.id !== mod.id));
        }
        else if (groupSelected < groupMax) {
            setSelectedModifiers((prev) => [...prev, mod]);
        }
    }
    function handleAdd() {
        onAdd({
            quantity,
            variantId: variant?.id,
            variantName: variant?.name,
            unitPrice,
            modifiers: selectedModifiers,
            notes: notes.trim() || undefined,
        });
        onClose();
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center", children: _jsxs("div", { className: "max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-secondary p-5 sm:rounded-2xl", children: [_jsxs("div", { className: "mb-4 flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold", children: item.name }), item.description ? (_jsx("p", { className: "mt-1 text-sm text-text-secondary", children: item.description })) : null] }), _jsx("button", { type: "button", onClick: onClose, className: "text-text-muted hover:text-text-primary", children: "\u2715" })] }), item.variants && item.variants.length > 0 ? (_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "mb-2 text-sm font-medium text-text-secondary", children: "Size" }), _jsx("div", { className: "flex flex-wrap gap-2", children: item.variants.map((v) => (_jsxs("button", { type: "button", onClick: () => setSelectedVariantId(v.id), className: `rounded-lg border px-3 py-2 text-sm ${selectedVariantId === v.id
                                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                    : 'border-white/10 bg-bg-card'}`, children: [v.name, " \u00B7 ", formatPrice(v.price)] }, v.id))) })] })) : null, item.modifierGroups?.map((group) => {
                    const groupSelected = selectedModifiers.filter((m) => group.modifiers.some((gm) => gm.id === m.id)).length;
                    return (_jsxs("div", { className: "mb-4", children: [_jsxs("p", { className: "mb-2 text-sm font-medium text-text-secondary", children: [group.name, group.minSelect > 0 ? (_jsxs("span", { className: "text-text-muted", children: [" \u00B7 pick ", group.minSelect] })) : null] }), _jsx("div", { className: "space-y-2", children: group.modifiers.map((mod) => {
                                    const selected = selectedModifiers.some((m) => m.id === mod.id);
                                    return (_jsxs("button", { type: "button", onClick: () => toggleModifier({ id: mod.id, name: mod.name, price: mod.price }, group.maxSelect, groupSelected), className: `flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${selected
                                            ? 'border-brand-primary bg-brand-primary/10'
                                            : 'border-white/10 bg-bg-card'}`, children: [_jsx("span", { children: mod.name }), mod.price > 0 ? (_jsxs("span", { className: "text-brand-primary", children: ["+", formatPrice(mod.price)] })) : null] }, mod.id));
                                }) })] }, group.id));
                }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { htmlFor: "item-notes", className: "mb-2 block text-sm font-medium text-text-secondary", children: "Special instructions" }), _jsx("textarea", { id: "item-notes", value: notes, onChange: (e) => setNotes(e.target.value), rows: 2, className: "w-full rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm outline-none focus:border-brand-primary", placeholder: "No onions, extra spicy\u2026" })] }), _jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: () => setQuantity((q) => Math.max(1, q - 1)), className: "flex h-9 w-9 items-center justify-center rounded-lg bg-bg-card text-lg", children: "\u2212" }), _jsx("span", { className: "w-6 text-center font-medium", children: quantity }), _jsx("button", { type: "button", onClick: () => setQuantity((q) => q + 1), className: "flex h-9 w-9 items-center justify-center rounded-lg bg-bg-card text-lg", children: "+" })] }), _jsx("span", { className: "text-lg font-semibold text-brand-primary", children: formatPrice(lineTotal) })] }), _jsx(Button, { className: "w-full", onClick: handleAdd, children: "Add to cart" })] }) }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';
export function PricingEditorPage() {
    const queryClient = useQueryClient();
    const { data: cards = [], isLoading } = useQuery({
        queryKey: ['marketing', 'pricing'],
        queryFn: () => marketingApi.listPricing('draft'),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, body }) => marketingApi.updatePricing(id, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'pricing'] }),
    });
    if (isLoading)
        return _jsx("p", { className: "text-text-muted", children: "Loading pricing\u2026" });
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Pricing cards" }), _jsx("div", { className: "space-y-4", children: cards.map((card) => (_jsxs("form", { className: "space-y-3 rounded-xl border border-white/10 bg-bg-card p-5", onSubmit: (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        updateMutation.mutate({
                            id: String(card.id),
                            body: {
                                name: fd.get('name'),
                                description: fd.get('description'),
                                priceMonthly: Number(fd.get('priceMonthly')),
                                priceYearly: Number(fd.get('priceYearly')),
                                highlighted: fd.get('highlighted') === 'on',
                            },
                        });
                    }, children: [_jsx("p", { className: "font-medium", children: String(card.planKey) }), _jsx("input", { name: "name", defaultValue: String(card.name), className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("textarea", { name: "description", defaultValue: String(card.description), rows: 2, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx("input", { name: "priceMonthly", type: "number", defaultValue: Number(card.priceMonthly), placeholder: "Monthly (paise)", className: "rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("input", { name: "priceYearly", type: "number", defaultValue: Number(card.priceYearly), placeholder: "Yearly (paise)", className: "rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { name: "highlighted", type: "checkbox", defaultChecked: Boolean(card.highlighted) }), "Highlight plan"] }), _jsx("button", { type: "submit", className: "rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary", children: "Save" })] }, String(card.id)))) })] }));
}

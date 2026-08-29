import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '@cullinos/ui';
import { kitchenApi } from '@/lib/api';
import { OrderTimer } from './OrderTimer';
import { Button } from './ui/Form';
const statusStyles = {
    NEW: {
        border: 'border-status-new',
        badge: 'bg-status-new/20 text-status-new',
        label: 'NEW',
    },
    PREPARING: {
        border: 'border-status-preparing',
        badge: 'bg-status-preparing/20 text-status-preparing',
        label: 'PREPARING',
    },
    READY: {
        border: 'border-status-ready',
        badge: 'bg-status-ready/20 text-status-ready',
        label: 'READY',
    },
    SERVED: {
        border: 'border-text-muted',
        badge: 'bg-white/10 text-text-muted',
        label: 'SERVED',
    },
};
function nextStatus(current) {
    if (current === 'NEW')
        return 'PREPARING';
    if (current === 'PREPARING')
        return 'READY';
    if (current === 'READY')
        return 'SERVED';
    return null;
}
export function KotCard({ kot, outletId }) {
    const queryClient = useQueryClient();
    const style = statusStyles[kot.status] ?? statusStyles.NEW;
    const tableLabel = kot.order.table?.name ?? kot.order.orderType;
    const updateMutation = useMutation({
        mutationFn: ({ itemId, status }) => kitchenApi.updateItemStatus(itemId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kitchen-display', outletId] });
        },
    });
    async function bumpAllItems() {
        const next = nextStatus(kot.status);
        if (!next)
            return;
        for (const item of kot.items) {
            if (item.status !== 'SERVED') {
                await updateMutation.mutateAsync({ itemId: item.id, status: next });
            }
        }
    }
    const next = nextStatus(kot.status);
    return (_jsxs("article", { className: `flex flex-col rounded-xl border-2 bg-bg-card p-4 shadow-lg ${style.border}`, style: { borderLeftColor: kot.status === 'NEW' ? colors.status.new : undefined }, children: [_jsxs("header", { className: "mb-3 flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "font-mono text-lg font-bold text-brand-primary", children: ["#", kot.kotNumber] }), kot.priority > 0 ? (_jsx("span", { className: "rounded-full bg-status-error/20 px-2 py-0.5 text-xs font-semibold text-status-error", children: "PRIORITY" })) : null] }), _jsxs("p", { className: "text-sm text-text-secondary", children: [tableLabel, " \u00B7 Order ", kot.order.orderNumber] })] }), _jsxs("div", { className: "flex flex-col items-end gap-1", children: [_jsx("span", { className: `rounded-md px-2 py-0.5 text-xs font-semibold ${style.badge}`, children: style.label }), _jsx(OrderTimer, { createdAt: kot.createdAt })] })] }), _jsx("ul", { className: "mb-4 flex-1 space-y-2", children: kot.items.map((item) => (_jsxs("li", { className: "flex items-center justify-between rounded-lg bg-bg-elevated/60 px-3 py-2 text-sm", children: [_jsxs("span", { children: [_jsxs("span", { className: "font-semibold text-brand-primary", children: [item.quantity, "\u00D7"] }), ' ', item.name, item.notes ? (_jsx("span", { className: "mt-0.5 block text-xs text-text-muted", children: item.notes })) : null] }), _jsx("span", { className: `text-xs font-medium ${statusStyles[item.status]?.badge ?? ''} rounded px-1.5 py-0.5`, children: item.status })] }, item.id))) }), kot.notes ? (_jsxs("p", { className: "mb-3 text-xs text-status-warning", children: ["Note: ", kot.notes] })) : null, next ? (_jsxs(Button, { variant: next === 'READY' ? 'success' : next === 'PREPARING' ? 'warning' : 'primary', className: "w-full", loading: updateMutation.isPending, onClick: () => void bumpAllItems(), children: ["Mark ", next === 'PREPARING' ? 'Preparing' : next === 'READY' ? 'Ready' : 'Served'] })) : null] }));
}

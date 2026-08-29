import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';
const statusColors = {
    DRAFT: 'text-text-muted',
    CONFIRMED: 'text-status-info',
    PREPARING: 'text-status-warning',
    READY: 'text-status-success',
    HELD: 'text-brand-accent',
    COMPLETED: 'text-status-success',
    CANCELLED: 'text-status-error',
};
export function OrdersPage() {
    const outletId = useAuthStore((s) => s.selectedOutletId);
    const { data, isLoading, error } = useQuery({
        queryKey: ['orders', outletId],
        queryFn: () => ordersApi.list({ outletId: outletId ?? undefined, limit: 50 }),
        enabled: Boolean(outletId),
    });
    const orders = data?.data ?? [];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Orders" }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: "Recent orders for the selected outlet." })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error instanceof Error ? error.message : 'Failed to load orders' })) : null, _jsx("div", { className: "overflow-hidden rounded-xl border border-white/5 bg-bg-card", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "border-b border-white/5 bg-bg-elevated text-text-secondary", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Order #" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Source" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Total" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Created" })] }) }), _jsx("tbody", { children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-8 text-center text-text-muted", children: "Loading orders\u2026" }) })) : orders.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-8 text-center text-text-muted", children: "No orders found." }) })) : (orders.map((order) => (_jsxs("tr", { className: "border-b border-white/5 last:border-0", children: [_jsx("td", { className: "px-4 py-3 font-mono", children: order.orderNumber }), _jsx("td", { className: `px-4 py-3 font-medium ${statusColors[order.status] ?? ''}`, children: order.status }), _jsx("td", { className: "px-4 py-3 text-text-secondary", children: order.source }), _jsx("td", { className: "px-4 py-3 font-mono", children: formatMoney(order.totalAmount) }), _jsx("td", { className: "px-4 py-3 text-text-secondary", children: formatDate(order.createdAt) })] }, order.id)))) })] }) })] }));
}

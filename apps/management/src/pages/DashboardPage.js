import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';
export function DashboardPage() {
    const user = useAuthStore((s) => s.user);
    const outletId = useAuthStore((s) => s.selectedOutletId);
    const { data, isLoading, error } = useQuery({
        queryKey: ['analytics', 'daily', outletId],
        queryFn: () => analyticsApi.daily({ outletId: outletId ?? undefined }),
    });
    const summary = data?.summary;
    const kpis = [
        { label: 'Consolidated revenue', value: summary ? formatMoney(summary.totalRevenue) : '—' },
        { label: 'Total orders', value: summary ? String(summary.totalOrders) : '—' },
        { label: 'Open orders', value: summary ? String(summary.openOrders) : '—' },
        { label: 'Avg order value', value: summary ? formatMoney(summary.averageOrderValue) : '—' },
    ];
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Enterprise overview" }), _jsxs("p", { className: "mt-1 text-text-secondary", children: ["Welcome back, ", user?.firstName, ". Consolidated performance across your network."] })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error instanceof Error ? error.message : 'Failed to load analytics' })) : null, _jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: kpis.map((kpi) => (_jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("p", { className: "text-sm text-text-muted", children: kpi.label }), _jsx("p", { className: "mt-2 text-2xl font-semibold", children: isLoading ? _jsx("span", { className: "inline-block h-8 w-24 animate-pulse rounded bg-bg-elevated" }) : kpi.value })] }, kpi.label))) }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "font-medium", children: "Payment mix" }), _jsxs("ul", { className: "mt-4 space-y-2", children: [(data?.paymentBreakdown ?? []).map((row) => (_jsxs("li", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "capitalize text-text-secondary", children: row.method }), _jsxs("span", { children: [formatMoney(row.amount), " \u00B7 ", row.count, " orders"] })] }, row.method))), !isLoading && (data?.paymentBreakdown?.length ?? 0) === 0 ? (_jsx("li", { className: "text-sm text-text-muted", children: "No payment data yet" })) : null] })] }), _jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "font-medium", children: "Hourly breakdown" }), _jsxs("ul", { className: "mt-4 max-h-64 space-y-2 overflow-y-auto", children: [(data?.hourlyBreakdown ?? []).map((row) => (_jsxs("li", { className: "flex justify-between text-sm", children: [_jsxs("span", { className: "text-text-secondary", children: [String(row.hour).padStart(2, '0'), ":00"] }), _jsxs("span", { children: [row.orders, " orders \u00B7 ", formatMoney(row.revenue)] })] }, row.hour))), !isLoading && (data?.hourlyBreakdown?.length ?? 0) === 0 ? (_jsx("li", { className: "text-sm text-text-muted", children: "No hourly data yet" })) : null] })] })] })] }));
}

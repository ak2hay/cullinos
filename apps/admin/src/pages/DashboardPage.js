import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
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
        enabled: Boolean(outletId),
    });
    const summary = data?.summary;
    const kpis = [
        {
            label: "Today's revenue",
            value: summary ? formatMoney(summary.totalRevenue) : '—',
            hint: data?.date ?? 'Daily totals',
        },
        {
            label: 'Orders completed',
            value: summary ? String(summary.totalOrders) : '—',
            hint: 'Completed today',
        },
        {
            label: 'Open orders',
            value: summary ? String(summary.openOrders) : '—',
            hint: 'In progress or held',
        },
        {
            label: 'Average order value',
            value: summary ? formatMoney(summary.averageOrderValue) : '—',
            hint: 'Per completed order',
        },
    ];
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-2xl font-semibold", children: ["Good ", getGreeting(), ", ", user?.firstName] }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Daily performance overview for your restaurant." })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error instanceof Error ? error.message : 'Failed to load analytics' })) : null, _jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: kpis.map((kpi) => (_jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("p", { className: "text-sm text-text-secondary", children: kpi.label }), isLoading ? (_jsx("div", { className: "mt-2 h-9 w-24 animate-pulse rounded bg-bg-elevated" })) : (_jsx("p", { className: "mt-2 font-mono text-3xl font-semibold text-brand-primary", children: kpi.value })), _jsx("p", { className: "mt-2 text-xs text-text-muted", children: kpi.hint })] }, kpi.label))) }), data?.paymentBreakdown.length ? (_jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Payment breakdown" }), _jsx("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: data.paymentBreakdown.map((payment) => (_jsxs("div", { className: "rounded-lg border border-white/5 bg-bg-elevated px-4 py-3", children: [_jsx("p", { className: "text-sm text-text-secondary", children: payment.method }), _jsx("p", { className: "mt-1 font-mono text-lg font-semibold", children: formatMoney(payment.amount) }), _jsxs("p", { className: "text-xs text-text-muted", children: [payment.count, " transactions"] })] }, payment.method))) })] })) : null] }));
}
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12)
        return 'morning';
    if (hour < 17)
        return 'afternoon';
    return 'evening';
}

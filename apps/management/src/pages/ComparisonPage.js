import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { BarChart } from '@/components/charts/BarChart';
import { analyticsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';
export function ComparisonPage() {
    const brandId = useAuthStore((s) => s.selectedBrandId);
    const { data = [], isLoading, error } = useQuery({
        queryKey: ['analytics', 'outlet-comparison', brandId],
        queryFn: () => analyticsApi.outletComparison({ brandId: brandId ?? undefined }),
        retry: false,
    });
    const revenueBars = data.map((row) => ({
        label: row.outletName,
        value: row.revenue,
        displayValue: formatMoney(row.revenue),
    }));
    const orderBars = data.map((row) => ({
        label: row.outletName,
        value: row.orders,
    }));
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Outlet comparison" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Compare revenue and order volume across outlets in the selected brand." })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning", children: "Outlet comparison API unavailable \u2014 showing placeholder when endpoints are not yet deployed." })) : null, isLoading ? (_jsx("div", { className: "h-48 animate-pulse rounded-xl bg-bg-card" })) : (_jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "mb-4 font-medium", children: "Revenue by outlet" }), _jsx(BarChart, { items: revenueBars, valueLabel: "Revenue (INR)" })] }), _jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "mb-4 font-medium", children: "Orders by outlet" }), _jsx(BarChart, { items: orderBars, valueLabel: "Order count", colorClass: "bg-brand-accent" })] })] }))] }));
}

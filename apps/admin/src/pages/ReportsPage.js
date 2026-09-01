import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
export function ReportsPage() {
    const summaryQuery = useQuery({
        queryKey: ['reports', 'smb'],
        queryFn: () => reportsApi.smbSummary(),
    });
    const data = summaryQuery.data;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Reports" }), _jsx("p", { className: "text-sm text-text-secondary", children: "Daily sales, peak hours, wastage, and inventory alerts." })] }), summaryQuery.isLoading ? (_jsx("p", { className: "text-text-muted", children: "Loading\u2026" })) : (_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(StatCard, { label: "Revenue", value: `₹${Number(data?.revenue ?? 0).toFixed(0)}` }), _jsx(StatCard, { label: "Orders", value: String(data?.orderCount ?? 0) }), _jsx(StatCard, { label: "Avg order", value: `₹${Number(data?.averageOrderValue ?? 0).toFixed(0)}` }), _jsx(StatCard, { label: "Tips", value: `₹${Number(data?.tips ?? 0).toFixed(0)}` })] })), _jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-4", children: [_jsx("h2", { className: "font-semibold", children: "Top items" }), _jsx("ul", { className: "mt-3 space-y-1 text-sm text-text-secondary", children: (data?.topItems ?? []).map((item) => (_jsxs("li", { children: [item.name, " \u2014 ", item.quantity, " sold"] }, item.name))) })] }), _jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-4", children: [_jsx("h2", { className: "font-semibold", children: "Peak hours" }), _jsx("ul", { className: "mt-3 space-y-1 text-sm text-text-secondary", children: (data?.peakHours ?? []).map((h) => (_jsxs("li", { children: [h.hour, ":00 \u2014 ", h.orders, " orders"] }, h.hour))) })] })] }));
}
function StatCard({ label, value }) {
    return (_jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-4", children: [_jsx("p", { className: "text-xs text-text-muted", children: label }), _jsx("p", { className: "mt-1 text-2xl font-semibold", children: value })] }));
}

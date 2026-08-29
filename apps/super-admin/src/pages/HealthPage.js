import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '@/lib/api';
export function HealthPage() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['super-admin', 'health'],
        queryFn: superAdminApi.health,
        refetchInterval: 30_000,
    });
    const metrics = data?.metrics;
    const cards = [
        { label: 'Total organizations', value: metrics?.totalOrganizations },
        { label: 'Active organizations', value: metrics?.activeOrganizations },
        { label: 'Orders today', value: metrics?.ordersToday },
        { label: 'Pending sync events', value: metrics?.pendingSyncEvents },
        { label: 'Failed notifications', value: metrics?.failedNotifications },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "System health" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Platform status and operational metrics." })] }), _jsx("button", { type: "button", onClick: () => refetch(), disabled: isFetching, className: "rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60", children: isFetching ? 'Refreshing…' : 'Refresh' })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error instanceof Error ? error.message : 'Failed to load health data' })) : null, _jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("span", { className: `h-3 w-3 rounded-full ${data?.status === 'ok' ? 'bg-status-success' : 'bg-status-warning'}` }), _jsxs("div", { children: [_jsx("p", { className: "font-medium capitalize", children: data?.status ?? (isLoading ? 'Loading…' : 'Unknown') }), _jsxs("p", { className: "text-sm text-text-muted", children: ["Database: ", data?.database ?? '—', " \u00B7 Last check:", ' ', data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'] })] })] }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: cards.map((card) => (_jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("p", { className: "text-sm text-text-muted", children: card.label }), _jsx("p", { className: "mt-2 text-2xl font-semibold", children: isLoading ? '…' : (card.value ?? 0) })] }, card.label))) })] }));
}

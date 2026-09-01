import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_API_BASE } from '@cullinos/shared';
import { outletsApi } from '@/lib/api';
const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;
export function PickupQueuePage() {
    const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
    const outletId = outletsQuery.data?.[0]?.id;
    const displayUrl = outletId
        ? `${API_BASE.replace('/api/v1', '')}/kds/?outletId=${outletId}&mode=pickup`
        : null;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Pickup queue" }), _jsx("p", { className: "text-sm text-text-secondary", children: "Customer-facing order board for counter-service and peak-hour rush." })] }), displayUrl ? (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-text-secondary", children: "Open this URL on a tablet or TV facing customers:" }), _jsx("code", { className: "block rounded-lg border border-white/10 bg-bg-card p-3 text-sm text-brand-primary", children: `http://localhost:5174/?outletId=${outletId}&mode=pickup` }), _jsx("p", { className: "text-xs text-text-muted", children: "KDS app with pickup mode shows preparing and ready orders in real time." })] })) : (_jsx("p", { className: "text-text-muted", children: "Loading outlets\u2026" }))] }));
}

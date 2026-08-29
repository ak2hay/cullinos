import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi } from '@/lib/api';
export function TenantsPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [suspendId, setSuspendId] = useState(null);
    const [reason, setReason] = useState('');
    const { data, isLoading, error } = useQuery({
        queryKey: ['super-admin', 'organizations', page],
        queryFn: () => superAdminApi.listOrganizations(page),
    });
    const suspendMutation = useMutation({
        mutationFn: ({ id, reason: r }) => superAdminApi.suspendOrganization(id, r),
        onSuccess: () => {
            setSuspendId(null);
            setReason('');
            queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
        },
    });
    const activateMutation = useMutation({
        mutationFn: (id) => superAdminApi.activateOrganization(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
        },
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Tenants" }), _jsxs("p", { className: "mt-1 text-text-secondary", children: ["Organizations on the platform \u2014 ", data?.meta.total ?? 0, " total."] })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error instanceof Error ? error.message : 'Failed to load tenants' })) : null, _jsx("div", { className: "overflow-hidden rounded-xl border border-white/5 bg-bg-card", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-white/5 bg-bg-secondary text-text-muted", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Organization" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Plan" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Outlets" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Users" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Actions" })] }) }), _jsx("tbody", { children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-8 text-center text-text-muted", children: "Loading tenants\u2026" }) })) : ((data?.data ?? []).map((tenant) => (_jsxs("tr", { className: "border-b border-white/5", children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "font-medium", children: tenant.name }), _jsx("p", { className: "text-xs text-text-muted", children: tenant.slug })] }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { children: tenant.plan ?? '—' }), _jsx("p", { className: "text-xs capitalize text-text-muted", children: tenant.subscriptionStatus?.toLowerCase() ?? 'no subscription' })] }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `rounded-full px-2 py-0.5 text-xs ${tenant.isActive
                                                ? 'bg-status-success/15 text-status-success'
                                                : 'bg-status-error/15 text-status-error'}`, children: tenant.isActive ? 'Active' : 'Suspended' }) }), _jsx("td", { className: "px-4 py-3", children: tenant.outletCount }), _jsx("td", { className: "px-4 py-3", children: tenant.userCount }), _jsx("td", { className: "px-4 py-3", children: tenant.isActive ? (_jsx("button", { type: "button", onClick: () => setSuspendId(tenant.id), className: "text-xs text-status-warning hover:underline", children: "Suspend" })) : (_jsx("button", { type: "button", onClick: () => activateMutation.mutate(tenant.id), disabled: activateMutation.isPending, className: "text-xs text-status-success hover:underline", children: "Activate" })) })] }, tenant.id)))) })] }) }), data?.meta.hasMore ? (_jsx("button", { type: "button", onClick: () => setPage((p) => p + 1), className: "rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5", children: "Load more" })) : null, suspendId ? (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-xl border border-white/10 bg-bg-secondary p-6", children: [_jsx("h2", { className: "text-lg font-medium", children: "Suspend organization" }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: "Provide a reason for suspension. Users will lose access immediately." }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), rows: 3, className: "mt-4 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent", placeholder: "Reason for suspension" }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setSuspendId(null), className: "rounded-lg px-4 py-2 text-sm hover:bg-white/5", children: "Cancel" }), _jsx("button", { type: "button", disabled: !reason.trim() || suspendMutation.isPending, onClick: () => suspendMutation.mutate({ id: suspendId, reason }), className: "rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: "Suspend" })] })] }) })) : null] }));
}

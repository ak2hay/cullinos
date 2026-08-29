import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi } from '@/lib/api';
export function SubscriptionsPage() {
    const queryClient = useQueryClient();
    const [selectedOrgId, setSelectedOrgId] = useState(null);
    const [planSlug, setPlanSlug] = useState('enterprise');
    const [status, setStatus] = useState('ACTIVE');
    const [message, setMessage] = useState(null);
    const { data, isLoading } = useQuery({
        queryKey: ['super-admin', 'organizations', 1],
        queryFn: () => superAdminApi.listOrganizations(1, 50),
    });
    const { data: plans = [] } = useQuery({
        queryKey: ['super-admin', 'plans'],
        queryFn: () => superAdminApi.listPlans(),
    });
    const updateMutation = useMutation({
        mutationFn: ({ orgId, planSlug: slug, status: s }) => superAdminApi.manageSubscription(orgId, { planSlug: slug, status: s }),
        onSuccess: () => {
            setMessage('Subscription updated successfully.');
            queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
        },
        onError: (err) => setMessage(err.message),
    });
    const selected = data?.data.find((t) => t.id === selectedOrgId);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Subscription management" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Update plan and subscription status for tenant organizations." })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "font-medium", children: "Select tenant" }), _jsx("ul", { className: "mt-4 max-h-96 divide-y divide-white/5 overflow-y-auto", children: isLoading ? (_jsx("li", { className: "py-4 text-sm text-text-muted", children: "Loading\u2026" })) : ((data?.data ?? []).map((tenant) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => {
                                            setSelectedOrgId(tenant.id);
                                            setPlanSlug(tenant.plan ?? 'enterprise');
                                            setStatus(tenant.subscriptionStatus?.toUpperCase() ?? 'ACTIVE');
                                        }, className: `w-full px-2 py-3 text-left text-sm transition hover:bg-white/5 ${selectedOrgId === tenant.id ? 'bg-white/5' : ''}`, children: [_jsx("p", { className: "font-medium", children: tenant.name }), _jsxs("p", { className: "text-xs text-text-muted", children: [tenant.plan ?? 'No plan', " \u00B7 ", tenant.subscriptionStatus ?? '—'] })] }) }, tenant.id)))) })] }), _jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "font-medium", children: "Tenant detail" }), selected ? (_jsxs("div", { className: "mt-4 space-y-4", children: [_jsxs("dl", { className: "grid grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Slug" }), _jsx("dd", { className: "font-mono", children: selected.slug })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Status" }), _jsx("dd", { children: selected.isActive ? 'Active' : 'Suspended' })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Outlets" }), _jsx("dd", { children: selected.outletCount })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Users" }), _jsx("dd", { children: selected.userCount })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("dt", { className: "text-text-muted", children: "Created" }), _jsx("dd", { children: new Date(selected.createdAt).toLocaleDateString() })] })] }), _jsxs("form", { className: "space-y-4 border-t border-white/5 pt-4", onSubmit: (e) => {
                                            e.preventDefault();
                                            setMessage(null);
                                            updateMutation.mutate({ orgId: selected.id, planSlug, status });
                                        }, children: [_jsx("h3", { className: "font-medium", children: "Update subscription" }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Plan" }), _jsxs("select", { value: planSlug, onChange: (e) => setPlanSlug(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent", children: [plans.map((plan) => (_jsxs("option", { value: plan.slug, children: [plan.name, " (", plan.slug, ")"] }, plan.id))), plans.length === 0 ? (_jsxs(_Fragment, { children: [_jsx("option", { value: "starter", children: "Starter" }), _jsx("option", { value: "professional", children: "Professional" }), _jsx("option", { value: "enterprise", children: "Enterprise" })] })) : null] })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Status" }), _jsxs("select", { value: status, onChange: (e) => setStatus(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent", children: [_jsx("option", { value: "ACTIVE", children: "Active" }), _jsx("option", { value: "TRIAL", children: "Trial" }), _jsx("option", { value: "PAST_DUE", children: "Past due" }), _jsx("option", { value: "CANCELLED", children: "Cancelled" })] })] }), message ? (_jsx("p", { className: "rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm", children: message })) : null, _jsx("button", { type: "submit", disabled: updateMutation.isPending, className: "rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium hover:bg-brand-primary-dark disabled:opacity-60", children: updateMutation.isPending ? 'Saving…' : 'Save subscription' })] })] })) : (_jsx("p", { className: "mt-4 text-sm text-text-muted", children: "Select a tenant to view details and manage subscription." }))] })] })] }));
}

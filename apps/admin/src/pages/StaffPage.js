import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { outletsApi, rolesApi, usersApi } from '@/lib/api';
const STAFF_ROLES = [
    { slug: 'waiter', label: 'Waiter — floor ordering' },
    { slug: 'cashier', label: 'Cashier — POS' },
    { slug: 'manager', label: 'Manager — operations' },
];
export function StaffPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [roleSlug, setRoleSlug] = useState('waiter');
    const [outletIds, setOutletIds] = useState([]);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const { data: staff = [], isLoading } = useQuery({
        queryKey: ['staff', 'users'],
        queryFn: usersApi.list,
    });
    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: outletsApi.list,
    });
    useQuery({
        queryKey: ['roles'],
        queryFn: rolesApi.list,
    });
    const createMutation = useMutation({
        mutationFn: usersApi.create,
        onSuccess: () => {
            setMessage('Staff account created. Share the email and password with your team member.');
            setError(null);
            setEmail('');
            setPassword('');
            setName('');
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['staff', 'users'] });
        },
        onError: (err) => {
            setError(err.message);
            setMessage(null);
        },
    });
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Staff" }), _jsx("p", { className: "mt-1 max-w-2xl text-text-secondary", children: "Create login credentials for your team. All restaurant staff accounts are added here by the owner \u2014 Cullinos does not auto-provision floor or kitchen users." })] }), _jsx(Button, { onClick: () => setShowForm((v) => !v), children: showForm ? 'Cancel' : 'Add staff member' })] }), showForm ? (_jsxs("section", { className: "rounded-xl border border-white/5 bg-bg-card p-6", children: [_jsx("h2", { className: "font-medium", children: "New staff account" }), _jsxs("form", { className: "mt-4 grid gap-4 sm:grid-cols-2", onSubmit: (e) => {
                            e.preventDefault();
                            setError(null);
                            setMessage(null);
                            createMutation.mutate({
                                email,
                                password,
                                name,
                                roleSlug,
                                outletIds: outletIds.length > 0 ? outletIds : outlets.map((o) => o.id),
                            });
                        }, children: [_jsx(Input, { label: "Full name", required: true, value: name, onChange: (e) => setName(e.target.value) }), _jsx(Input, { label: "Email (login)", type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value) }), _jsx(Input, { label: "Temporary password", type: "password", required: true, minLength: 8, value: password, onChange: (e) => setPassword(e.target.value) }), _jsxs("label", { className: "block sm:col-span-2", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Role" }), _jsx("select", { value: roleSlug, onChange: (e) => setRoleSlug(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary", children: STAFF_ROLES.map((role) => (_jsx("option", { value: role.slug, children: role.label }, role.slug))) })] }), outlets.length > 1 ? (_jsxs("div", { className: "sm:col-span-2", children: [_jsx("p", { className: "mb-2 text-sm text-text-secondary", children: "Outlet access" }), _jsx("div", { className: "flex flex-wrap gap-3", children: outlets.map((outlet) => (_jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: outletIds.includes(outlet.id), onChange: (e) => {
                                                        setOutletIds((prev) => e.target.checked
                                                            ? [...prev, outlet.id]
                                                            : prev.filter((id) => id !== outlet.id));
                                                    }, className: "accent-brand-primary" }), outlet.name] }, outlet.id))) })] })) : null, error ? (_jsx("p", { className: "sm:col-span-2 text-sm text-status-error", children: error })) : null, message ? (_jsx("p", { className: "sm:col-span-2 text-sm text-status-success", children: message })) : null, _jsx("div", { className: "sm:col-span-2", children: _jsx(Button, { type: "submit", loading: createMutation.isPending, children: "Create account" }) })] })] })) : null, _jsx("section", { className: "overflow-hidden rounded-xl border border-white/5 bg-bg-card", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-white/5 bg-bg-secondary text-text-muted", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Name" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Email" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Role" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Outlets" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" })] }) }), _jsxs("tbody", { children: [isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-8 text-center text-text-muted", children: "Loading staff\u2026" }) })) : (staff.map((user) => (_jsxs("tr", { className: "border-b border-white/5", children: [_jsx("td", { className: "px-4 py-3 font-medium", children: user.name }), _jsx("td", { className: "px-4 py-3 text-text-secondary", children: user.email }), _jsx("td", { className: "px-4 py-3 capitalize", children: user.roles.map((r) => r.name).join(', ') || '—' }), _jsx("td", { className: "px-4 py-3 text-text-secondary", children: user.outlets.map((o) => o.name).join(', ') || '—' }), _jsx("td", { className: "px-4 py-3 capitalize", children: user.status })] }, user.id)))), !isLoading && staff.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-8 text-center text-text-muted", children: "No staff accounts yet. Add your first team member above." }) })) : null] })] }) })] }));
}

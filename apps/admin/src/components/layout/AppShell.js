import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CULLINOS_BRAND } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { OutletSelector } from './OutletSelector';
const navItems = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/menu', label: 'Menu' },
    { to: '/orders', label: 'Orders' },
    { to: '/tables', label: 'Tables' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/customers', label: 'Customers' },
    { to: '/staff', label: 'Staff' },
    { to: '/reports', label: 'Reports' },
    { to: '/settings', label: 'Settings' },
];
export function AppShell() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    function handleLogout() {
        logout();
        navigate('/login');
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-bg-primary", children: [_jsxs("aside", { className: "flex w-64 shrink-0 flex-col border-r border-white/5 bg-bg-secondary", children: [_jsx("div", { className: "border-b border-white/5 p-5", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary", children: "C" }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: CULLINOS_BRAND.name }), _jsx("p", { className: "text-xs text-text-muted", children: "Admin" })] })] }) }), _jsx("nav", { className: "flex-1 space-y-1 overflow-y-auto p-3", children: navItems.map((item) => (_jsx(NavLink, { to: item.to, end: item.end, className: ({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm transition ${isActive
                                ? 'bg-brand-primary/15 font-medium text-brand-primary'
                                : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`, children: item.label }, item.to))) }), _jsxs("div", { className: "border-t border-white/5 p-4", children: [_jsxs("p", { className: "truncate text-sm font-medium", children: [user?.firstName, " ", user?.lastName] }), _jsx("p", { className: "truncate text-xs text-text-muted", children: user?.email }), _jsx("button", { type: "button", onClick: handleLogout, className: "mt-3 text-sm text-text-secondary hover:text-text-primary", children: "Sign out" })] })] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("header", { className: "flex h-16 items-center justify-between border-b border-white/5 px-6", children: _jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-muted", children: "Outlet" }), _jsx(OutletSelector, {})] }) }), _jsx("main", { className: "flex-1 overflow-auto p-6", children: _jsx(Outlet, {}) })] })] }));
}

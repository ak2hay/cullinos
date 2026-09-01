import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
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
    { to: '/events', label: 'Events' },
    { to: '/production', label: 'Production' },
    { to: '/pickup-queue', label: 'Pickup Queue' },
    { to: '/staff', label: 'Staff' },
    { to: '/reports', label: 'Reports' },
    { to: '/onboarding', label: 'Setup' },
    { to: '/settings', label: 'Settings' },
];
function SidebarNav({ onNavigate }) {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    function handleLogout() {
        logout();
        navigate('/login');
        onNavigate?.();
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "border-b border-white/5 p-5", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary", children: "C" }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: CULLINOS_BRAND.name }), _jsx("p", { className: "text-xs text-text-muted", children: "Admin" })] })] }) }), _jsx("nav", { className: "flex-1 space-y-1 overflow-y-auto p-3", children: navItems.map((item) => (_jsx(NavLink, { to: item.to, end: item.end, onClick: onNavigate, className: ({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm transition ${isActive
                        ? 'bg-brand-primary/15 font-medium text-brand-primary'
                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`, children: item.label }, item.to))) }), _jsxs("div", { className: "border-t border-white/5 p-4", children: [_jsxs("p", { className: "truncate text-sm font-medium", children: [user?.firstName, " ", user?.lastName] }), _jsx("p", { className: "truncate text-xs text-text-muted", children: user?.email }), _jsx("button", { type: "button", onClick: handleLogout, className: "mt-3 text-sm text-text-secondary hover:text-text-primary", children: "Sign out" })] })] }));
}
export function AppShell({ compact, children }) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    return (_jsxs("div", { className: "flex min-h-screen bg-bg-primary", children: [_jsx("aside", { className: "hidden w-64 shrink-0 flex-col border-r border-white/5 bg-bg-secondary lg:flex", children: _jsx(SidebarNav, {}) }), mobileNavOpen ? (_jsxs("div", { className: "fixed inset-0 z-40 lg:hidden", children: [_jsx("button", { type: "button", "aria-label": "Close navigation", className: "absolute inset-0 bg-black/60", onClick: () => setMobileNavOpen(false) }), _jsx("aside", { className: "relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-white/5 bg-bg-secondary shadow-xl", children: _jsx(SidebarNav, { onNavigate: () => setMobileNavOpen(false) }) })] })) : null, _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("header", { className: "flex h-16 items-center justify-between gap-4 border-b border-white/5 px-4 sm:px-6", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", "aria-label": "Open navigation", className: "rounded-lg border border-white/10 p-2 text-text-secondary lg:hidden", onClick: () => setMobileNavOpen(true), children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 7h16M4 12h16M4 17h16", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) }), !compact ? (_jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-muted", children: "Outlet" }), _jsx(OutletSelector, {})] })) : (_jsx("p", { className: "text-sm font-medium text-text-secondary", children: "Restaurant setup" }))] }) }), _jsx("main", { className: "flex-1 overflow-auto p-4 sm:p-6", children: children ?? _jsx(Outlet, {}) })] })] }));
}

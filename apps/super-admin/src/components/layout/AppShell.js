import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { RKYVES_BRAND } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
const navItems = [
    { to: '/', label: 'Tenants', end: true },
    { to: '/subscriptions', label: 'Subscriptions' },
    { to: '/health', label: 'System health' },
    { to: '/marketing', label: 'Marketing CMS' },
];
function SidebarNav({ onNavigate }) {
    const navigate = useNavigate();
    const admin = useAuthStore((s) => s.admin);
    const logout = useAuthStore((s) => s.logout);
    function handleLogout() {
        logout();
        navigate('/login');
        onNavigate?.();
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "border-b border-white/5 p-5", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono text-sm font-bold text-text-primary", children: "R" }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: RKYVES_BRAND.name }), _jsx("p", { className: "text-xs text-text-muted", children: RKYVES_BRAND.tagline })] })] }), _jsxs("p", { className: "mt-3 text-xs text-text-muted", children: [RKYVES_BRAND.product, " tenant operations"] })] }), _jsx("nav", { className: "flex-1 space-y-1 p-3", children: navItems.map((item) => (_jsx(NavLink, { to: item.to, end: item.end, onClick: onNavigate, className: ({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm transition ${isActive
                        ? 'bg-white/10 font-medium text-text-primary'
                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`, children: item.label }, item.to))) }), _jsxs("div", { className: "border-t border-white/5 p-4", children: [_jsx("p", { className: "truncate text-sm font-medium", children: admin?.name ?? admin?.email }), _jsx("p", { className: "truncate text-xs text-text-muted", children: admin?.email }), _jsx("button", { type: "button", onClick: handleLogout, className: "mt-3 text-sm text-text-secondary hover:text-text-primary", children: "Sign out" })] })] }));
}
export function AppShell() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    return (_jsxs("div", { className: "flex min-h-screen bg-bg-primary", children: [_jsx("aside", { className: "hidden w-60 shrink-0 flex-col border-r border-white/5 bg-bg-secondary lg:flex", children: _jsx(SidebarNav, {}) }), mobileNavOpen ? (_jsxs("div", { className: "fixed inset-0 z-40 lg:hidden", children: [_jsx("button", { type: "button", "aria-label": "Close navigation", className: "absolute inset-0 bg-black/60", onClick: () => setMobileNavOpen(false) }), _jsx("aside", { className: "relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-white/5 bg-bg-secondary shadow-xl", children: _jsx(SidebarNav, { onNavigate: () => setMobileNavOpen(false) }) })] })) : null, _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsxs("header", { className: "flex h-14 items-center border-b border-white/5 px-4 lg:hidden", children: [_jsx("button", { type: "button", "aria-label": "Open navigation", className: "rounded-lg border border-white/10 p-2 text-text-secondary", onClick: () => setMobileNavOpen(true), children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 7h16M4 12h16M4 17h16", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) }), _jsx("p", { className: "ml-3 text-sm font-medium", children: "Platform admin" })] }), _jsx("main", { className: "flex-1 overflow-auto p-4 sm:p-6", children: _jsx(Outlet, {}) })] })] }));
}

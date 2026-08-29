import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { MenuPage } from '@/pages/MenuPage';
import { storefrontApi } from '@/lib/api';
import { useSessionStore } from '@/stores/session';
function StorefrontBootstrap({ children }) {
    const { orgSlug, outletSlug } = useParams();
    const setStorefront = useSessionStore((s) => s.setStorefront);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['storefront', orgSlug, outletSlug],
        queryFn: () => storefrontApi.bootstrap(orgSlug, outletSlug),
        enabled: Boolean(orgSlug && outletSlug),
    });
    useEffect(() => {
        if (data)
            setStorefront(data);
    }, [data, setStorefront]);
    if (isLoading) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-bg-primary text-text-secondary", children: "Loading menu\u2026" }));
    }
    if (isError || !data) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-bg-primary p-6 text-center text-status-error", children: "Store not found. Check your ordering link." }));
    }
    return children;
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(LegacyRedirect, {}) }), _jsx(Route, { path: "/:orgSlug/:outletSlug", element: _jsx(StorefrontBootstrap, { children: _jsx(MenuPage, {}) }) }), _jsx(Route, { path: "/:orgSlug/:outletSlug/cart", element: _jsx(StorefrontBootstrap, { children: _jsx(CartPage, {}) }) }), _jsx(Route, { path: "/:orgSlug/:outletSlug/checkout", element: _jsx(StorefrontBootstrap, { children: _jsx(CheckoutPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
function LegacyRedirect() {
    const orgSlug = import.meta.env.VITE_ORG_SLUG ?? 'demo-restaurant';
    const outletSlug = import.meta.env.VITE_OUTLET_SLUG ?? 'main-outlet';
    return _jsx(Navigate, { to: `/${orgSlug}/${outletSlug}`, replace: true });
}

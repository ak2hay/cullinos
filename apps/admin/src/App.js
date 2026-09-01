import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { MenuPage } from '@/pages/MenuPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { EventsPage } from '@/pages/EventsPage';
import { ProductionPage } from '@/pages/ProductionPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { PickupQueuePage } from '@/pages/PickupQueuePage';
import { StaffPage } from '@/pages/StaffPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useAuthStore } from '@/stores/auth';
function PublicOnly({ children }) {
    const accessToken = useAuthStore((s) => s.accessToken);
    if (accessToken) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return children;
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(PublicOnly, { children: _jsx(LoginPage, {}) }) }), _jsx(Route, { path: "/register", element: _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/onboarding", element: _jsx(ProtectedRoute, { children: _jsx(AppShell, { compact: true, children: _jsx(OnboardingWizard, {}) }) }) }), _jsxs(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(AppShell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "menu", element: _jsx(MenuPage, {}) }), _jsx(Route, { path: "orders", element: _jsx(OrdersPage, {}) }), _jsx(Route, { path: "tables", element: _jsx(PlaceholderPage, { title: "Tables", phase: "Phase 2 \u2014 Table Management" }) }), _jsx(Route, { path: "inventory", element: _jsx(PlaceholderPage, { title: "Inventory", phase: "Phase 2 \u2014 Inventory Management" }) }), _jsx(Route, { path: "customers", element: _jsx(CustomersPage, {}) }), _jsx(Route, { path: "events", element: _jsx(EventsPage, {}) }), _jsx(Route, { path: "production", element: _jsx(ProductionPage, {}) }), _jsx(Route, { path: "pickup-queue", element: _jsx(PickupQueuePage, {}) }), _jsx(Route, { path: "staff", element: _jsx(StaffPage, {}) }), _jsx(Route, { path: "reports", element: _jsx(ReportsPage, {}) }), _jsx(Route, { path: "settings", element: _jsx(SettingsPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}

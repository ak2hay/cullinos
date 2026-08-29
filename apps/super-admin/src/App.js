import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { HealthPage } from '@/pages/HealthPage';
import { LoginPage } from '@/pages/LoginPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { TenantsPage } from '@/pages/TenantsPage';
import { BlogEditorPage } from '@/pages/marketing/BlogEditorPage';
import { DesignLabPage } from '@/pages/marketing/DesignLabPage';
import { HeroEditorPage } from '@/pages/marketing/HeroEditorPage';
import { MarketingDashboardPage } from '@/pages/marketing/MarketingDashboardPage';
import { MediaLibraryPage } from '@/pages/marketing/MediaLibraryPage';
import { NavigationEditorPage } from '@/pages/marketing/NavigationEditorPage';
import { PagesEditorPage } from '@/pages/marketing/PagesEditorPage';
import { PricingEditorPage } from '@/pages/marketing/PricingEditorPage';
import { ThemeEditorPage } from '@/pages/marketing/ThemeEditorPage';
import { useAuthStore } from '@/stores/auth';
function PublicOnly({ children }) {
    const accessToken = useAuthStore((s) => s.accessToken);
    if (accessToken) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return children;
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(PublicOnly, { children: _jsx(LoginPage, {}) }) }), _jsxs(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(AppShell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(TenantsPage, {}) }), _jsx(Route, { path: "subscriptions", element: _jsx(SubscriptionsPage, {}) }), _jsx(Route, { path: "health", element: _jsx(HealthPage, {}) }), _jsx(Route, { path: "marketing", element: _jsx(MarketingDashboardPage, {}) }), _jsx(Route, { path: "marketing/media", element: _jsx(MediaLibraryPage, {}) }), _jsx(Route, { path: "marketing/hero", element: _jsx(HeroEditorPage, {}) }), _jsx(Route, { path: "marketing/pages", element: _jsx(PagesEditorPage, {}) }), _jsx(Route, { path: "marketing/theme", element: _jsx(ThemeEditorPage, {}) }), _jsx(Route, { path: "marketing/pricing", element: _jsx(PricingEditorPage, {}) }), _jsx(Route, { path: "marketing/navigation", element: _jsx(NavigationEditorPage, {}) }), _jsx(Route, { path: "marketing/blog", element: _jsx(BlogEditorPage, {}) }), _jsx(Route, { path: "marketing/design-lab", element: _jsx(DesignLabPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}

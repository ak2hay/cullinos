import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { ComparisonPage } from '@/pages/ComparisonPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FranchisePage } from '@/pages/FranchisePage';
import { LoginPage } from '@/pages/LoginPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { StockTransferPage } from '@/pages/StockTransferPage';
import { useAuthStore } from '@/stores/auth';
function PublicOnly({ children }) {
    const accessToken = useAuthStore((s) => s.accessToken);
    if (accessToken) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return children;
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(PublicOnly, { children: _jsx(LoginPage, {}) }) }), _jsxs(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(AppShell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "reports", element: _jsx(ReportsPage, {}) }), _jsx(Route, { path: "comparison", element: _jsx(ComparisonPage, {}) }), _jsx(Route, { path: "stock-transfer", element: _jsx(StockTransferPage, {}) }), _jsx(Route, { path: "franchise", element: _jsx(FranchisePage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}

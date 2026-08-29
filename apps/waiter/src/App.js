import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MobileShell } from '@/components/layout/MobileShell';
import { LoginPage } from '@/pages/LoginPage';
import { OrderPage } from '@/pages/OrderPage';
import { TablesPage } from '@/pages/TablesPage';
import { useAuthStore } from '@/stores/auth';
function PublicOnly({ children }) {
    const accessToken = useAuthStore((s) => s.accessToken);
    if (accessToken) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return children;
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(PublicOnly, { children: _jsx(LoginPage, {}) }) }), _jsxs(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(MobileShell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(TablesPage, {}) }), _jsx(Route, { path: "order/:tableId", element: _jsx(OrderPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}

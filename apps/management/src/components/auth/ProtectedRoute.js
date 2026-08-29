import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
export function ProtectedRoute({ children }) {
    const accessToken = useAuthStore((s) => s.accessToken);
    const location = useLocation();
    if (!accessToken) {
        return _jsx(Navigate, { to: "/login", state: { from: location }, replace: true });
    }
    return children;
}

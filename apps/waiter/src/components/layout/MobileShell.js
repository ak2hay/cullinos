import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Form';
import { useWaiterSocket } from '@/hooks/useWaiterSocket';
import { useAuthStore } from '@/stores/auth';
export function MobileShell() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    useWaiterSocket();
    function handleLogout() {
        logout();
        navigate('/login');
    }
    return (_jsxs("div", { className: "flex min-h-screen flex-col bg-bg-primary", children: [_jsxs("header", { className: "sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-bg-secondary/95 px-4 py-3 backdrop-blur", children: [_jsxs("button", { type: "button", onClick: () => navigate('/'), className: "text-left", children: [_jsx("p", { className: "text-sm font-semibold text-brand-primary", children: "Cullinos Waiter" }), _jsx("p", { className: "text-xs text-text-secondary", children: user ? `${user.firstName}` : 'Staff' })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleLogout, children: "Logout" })] }), _jsx("main", { className: "flex-1 overflow-y-auto pb-safe", children: _jsx(Outlet, {}) })] }));
}

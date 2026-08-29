import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await authApi.login({ email, password });
            setAuth(response);
            navigate('/');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx(AuthLayout, { children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold", children: "Cashier sign in" }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: "Enter your credentials to open the register" })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error })) : null, _jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-text-secondary", children: "Email" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "h-14 w-full rounded-xl border border-white/10 bg-bg-card px-4 text-lg outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-text-secondary", children: "Password" }), _jsx("input", { id: "password", type: "password", autoComplete: "current-password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "h-14 w-full rounded-xl border border-white/10 bg-bg-card px-4 text-lg outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" })] }), _jsx("button", { type: "submit", disabled: loading, className: "h-14 w-full rounded-xl bg-brand-primary text-lg font-semibold text-bg-primary transition hover:bg-brand-primary-dark disabled:opacity-60", children: loading ? 'Signing in…' : 'Open register' })] }) }));
}

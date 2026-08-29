import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = await authApi.login({ email, password });
            setAuth({
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                user: response.user,
                permissions: response.permissions,
            });
            navigate('/');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-bg-primary px-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl border border-white/10 bg-bg-secondary p-8", children: [_jsxs("div", { className: "mb-8 text-center", children: [_jsx("div", { className: "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary font-mono text-xl font-bold text-bg-primary", children: "M" }), _jsx("h1", { className: "text-2xl font-semibold", children: "Management Console" }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: "Sign in to manage outlets, reports, and franchise operations." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Email" }), _jsx("input", { type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary" })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Password" }), _jsx("input", { type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary" })] }), error ? (_jsx("p", { className: "rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error", children: error })) : null, _jsx("button", { type: "submit", disabled: loading, className: "w-full rounded-lg bg-brand-primary py-2.5 text-sm font-medium text-bg-primary transition hover:bg-brand-primary-dark disabled:opacity-60", children: loading ? 'Signing in…' : 'Sign in' })] }), _jsx("p", { className: "mt-6 text-center text-sm text-text-secondary", children: "Enterprise access is granted by your organization administrator after onboarding." })] }) }));
}

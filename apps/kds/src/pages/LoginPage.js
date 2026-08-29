import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@/components/ui/Form';
import { authApi, outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);
    const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
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
            const outlets = await outletsApi.list();
            const active = outlets.find((o) => o.isActive);
            if (active) {
                setSelectedOutlet(active.id);
            }
            navigate('/');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx(AuthLayout, { title: "Kitchen login", subtitle: "Sign in to open the kitchen display", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [error ? (_jsx("div", { className: "rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error })) : null, _jsx(Input, { label: "Email", type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value) }), _jsx(Input, { label: "Password", type: "password", autoComplete: "current-password", required: true, value: password, onChange: (e) => setPassword(e.target.value) }), _jsx(Button, { type: "submit", className: "w-full", loading: loading, children: "Open KDS" })] }) }));
}

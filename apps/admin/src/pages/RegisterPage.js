import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthFooterLink, AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@/components/ui/Form';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function RegisterPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);
    const [form, setForm] = useState({
        organizationName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    function updateField(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await authApi.register({
                organizationName: form.organizationName,
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email,
                password: form.password,
                phone: form.phone || undefined,
            });
            setAuth(response);
            navigate('/');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs(AuthLayout, { title: "Get started", subtitle: "Create your organization and owner account", children: [_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [error ? (_jsx("div", { className: "rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error })) : null, _jsx(Input, { label: "Restaurant / Organization name", required: true, value: form.organizationName, onChange: (e) => updateField('organizationName', e.target.value) }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Input, { label: "First name", required: true, value: form.firstName, onChange: (e) => updateField('firstName', e.target.value) }), _jsx(Input, { label: "Last name", required: true, value: form.lastName, onChange: (e) => updateField('lastName', e.target.value) })] }), _jsx(Input, { label: "Email", type: "email", autoComplete: "email", required: true, value: form.email, onChange: (e) => updateField('email', e.target.value) }), _jsx(Input, { label: "Phone (optional)", type: "tel", value: form.phone, onChange: (e) => updateField('phone', e.target.value) }), _jsx(Input, { label: "Password", type: "password", autoComplete: "new-password", required: true, minLength: 8, value: form.password, onChange: (e) => updateField('password', e.target.value) }), _jsx(Button, { type: "submit", className: "w-full", loading: loading, children: "Create account" })] }), _jsx(AuthFooterLink, { text: "Already have an account?", linkText: "Sign in", to: "/login" })] }));
}

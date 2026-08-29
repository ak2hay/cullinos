import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { CULLINOS_BRAND } from '@/lib/api';
export function AuthLayout({ title, subtitle, children }) {
    return (_jsx("div", { className: "flex min-h-screen bg-bg-primary", children: _jsx("div", { className: "flex w-full flex-col justify-center px-6 py-12", children: _jsxs("div", { className: "mx-auto w-full max-w-sm", children: [_jsxs("div", { className: "mb-8 flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary font-mono text-lg font-bold text-bg-primary", children: "W" }), _jsxs("div", { children: [_jsxs("p", { className: "text-lg font-semibold", children: [CULLINOS_BRAND.name, " Waiter"] }), _jsx("p", { className: "text-sm text-text-secondary", children: "Mobile service app" })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-2xl font-semibold", children: title }), _jsx("p", { className: "mt-2 text-text-secondary", children: subtitle })] }), children, _jsx("p", { className: "mt-8 text-center text-xs text-text-muted", children: CULLINOS_BRAND.poweredBy })] }) }) }));
}
export function AuthFooterLink({ text, linkText, to, }) {
    return (_jsxs("p", { className: "mt-6 text-center text-sm text-text-secondary", children: [text, ' ', _jsx(Link, { to: to, className: "font-medium text-brand-primary hover:text-brand-primary-dark", children: linkText })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CULLINOS_BRAND } from '@/lib/api';
export function AuthLayout({ children }) {
    return (_jsxs("div", { className: "flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6", children: [_jsxs("div", { className: "mb-10 flex items-center gap-4", children: [_jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary font-mono text-3xl font-bold text-bg-primary", children: "C" }), _jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold", children: CULLINOS_BRAND.name }), _jsx("p", { className: "text-lg text-text-secondary", children: "Point of Sale" })] })] }), _jsx("div", { className: "w-full max-w-md rounded-2xl border border-white/10 bg-bg-secondary p-8 shadow-xl", children: children })] }));
}

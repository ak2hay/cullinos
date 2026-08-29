import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const variants = {
    primary: 'bg-brand-primary text-bg-primary hover:bg-brand-primary-dark disabled:opacity-60',
    secondary: 'bg-bg-elevated text-text-primary border border-white/10 hover:bg-bg-card disabled:opacity-60',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-white/5 disabled:opacity-60',
};
const sizes = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-11 px-4 text-sm',
};
export function Button({ variant = 'primary', loading, size = 'md', className = '', children, disabled, ...props }) {
    return (_jsx("button", { className: `inline-flex items-center justify-center rounded-lg font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className}`, disabled: disabled || loading, ...props, children: loading ? 'Please wait…' : children }));
}
export function Input({ label, error, id, className = '', ...props }) {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { htmlFor: inputId, className: "block text-sm font-medium text-text-secondary", children: label }), _jsx("input", { id: inputId, className: `h-11 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${error ? 'border-status-error' : ''} ${className}`, ...props }), error ? _jsx("p", { className: "text-sm text-status-error", children: error }) : null] }));
}

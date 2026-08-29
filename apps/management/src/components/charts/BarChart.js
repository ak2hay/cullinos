import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BarChart({ items, valueLabel = 'Value', colorClass = 'bg-brand-primary', }) {
    const max = Math.max(...items.map((i) => i.value), 1);
    if (items.length === 0) {
        return (_jsx("div", { className: "rounded-xl border border-white/5 bg-bg-card p-8 text-center text-sm text-text-muted", children: "No data to display" }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [items.map((item) => {
                const width = `${Math.round((item.value / max) * 100)}%`;
                return (_jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between text-sm", children: [_jsx("span", { className: "font-medium", children: item.label }), _jsx("span", { className: "text-text-secondary", children: item.displayValue ?? item.value.toLocaleString('en-IN') })] }), _jsx("div", { className: "h-3 overflow-hidden rounded-full bg-bg-elevated", children: _jsx("div", { className: `h-full rounded-full transition-all ${colorClass}`, style: { width }, title: `${item.label}: ${item.displayValue ?? item.value}` }) })] }, item.label));
            }), _jsx("p", { className: "text-xs text-text-muted", children: valueLabel })] }));
}

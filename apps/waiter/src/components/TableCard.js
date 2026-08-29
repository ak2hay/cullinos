import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TABLE_STATUS_COLORS } from '@/lib/api';
const statusLabels = {
    AVAILABLE: 'Available',
    OCCUPIED: 'Occupied',
    RESERVED: 'Reserved',
    CLEANING: 'Cleaning',
    BILLING: 'Billing',
};
export function TableCard({ table, activeOrderCount = 0, onSelect }) {
    const dotColor = TABLE_STATUS_COLORS[table.status] ?? 'bg-text-muted';
    return (_jsxs("button", { type: "button", onClick: onSelect, className: "flex w-full flex-col rounded-xl border border-white/10 bg-bg-card p-4 text-left transition hover:border-brand-primary/40 hover:bg-bg-elevated active:scale-[0.98]", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("span", { className: "text-lg font-semibold", children: table.name }), _jsx("span", { className: `h-3 w-3 rounded-full ${dotColor}`, title: table.status })] }), _jsxs("p", { className: "text-xs text-text-secondary", children: [statusLabels[table.status] ?? table.status, " \u00B7 ", table.capacity, " seats"] }), table.section ? (_jsx("p", { className: "mt-1 text-xs text-text-muted", children: table.section.name })) : null, activeOrderCount > 0 ? (_jsxs("span", { className: "mt-2 inline-flex w-fit rounded-full bg-brand-primary/20 px-2 py-0.5 text-xs font-medium text-brand-primary", children: [activeOrderCount, " active order", activeOrderCount > 1 ? 's' : ''] })) : null] }));
}

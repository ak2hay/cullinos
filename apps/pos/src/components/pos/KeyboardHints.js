import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function KeyboardHints() {
    const hints = [
        { key: '/', label: 'Search' },
        { key: 'Enter', label: 'Checkout' },
        { key: 'H', label: 'Hold order' },
        { key: 'Esc', label: 'Clear cart' },
    ];
    return (_jsx("div", { className: "hidden items-center gap-4 text-xs text-text-muted xl:flex", children: hints.map((hint) => (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("kbd", { className: "rounded border border-white/10 bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-secondary", children: hint.key }), hint.label] }, hint.key))) }));
}

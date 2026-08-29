import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PlaceholderPage({ title, phase }) {
    return (_jsx("div", { className: "flex min-h-[50vh] flex-col items-center justify-center text-center", children: _jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card px-8 py-12", children: [_jsx("h1", { className: "text-2xl font-semibold", children: title }), _jsxs("p", { className: "mt-2 text-text-secondary", children: ["This module is planned for ", phase, "."] }), _jsx("span", { className: "mt-4 inline-block rounded-full bg-brand-primary/15 px-3 py-1 text-sm text-brand-primary", children: "Coming soon" })] }) }));
}

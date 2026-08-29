import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
export const SearchBar = forwardRef(function SearchBar({ value, onChange }, ref) {
    return (_jsx("div", { className: "relative", children: _jsx("input", { ref: ref, type: "search", placeholder: "Search items\u2026 ( / )", value: value, onChange: (e) => onChange(e.target.value), className: "h-12 w-full rounded-xl border border-white/10 bg-bg-elevated pl-4 pr-4 text-base outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" }) }));
});

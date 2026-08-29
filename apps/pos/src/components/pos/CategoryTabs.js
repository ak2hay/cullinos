import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CategoryTabs({ categories, selectedId, onSelect }) {
    return (_jsxs("div", { className: "flex gap-2 overflow-x-auto pb-1", children: [_jsx("button", { type: "button", onClick: () => onSelect(null), className: `shrink-0 rounded-xl px-5 py-3 text-base font-medium transition active:scale-95 ${selectedId === null
                    ? 'bg-brand-primary text-bg-primary'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary'}`, children: "All" }), categories.map((category) => (_jsx("button", { type: "button", onClick: () => onSelect(category.id), className: `shrink-0 rounded-xl px-5 py-3 text-base font-medium transition active:scale-95 ${selectedId === category.id
                    ? 'bg-brand-primary text-bg-primary'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary'}`, children: category.name }, category.id)))] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';
const TOKEN_KEYS = [
    'brandPrimary',
    'brandGold',
    'bgPrimary',
    'bgSecondary',
    'bgCard',
    'textPrimary',
    'textSecondary',
    'border',
];
export function ThemeEditorPage() {
    const queryClient = useQueryClient();
    const { data: theme, isLoading } = useQuery({
        queryKey: ['marketing', 'theme'],
        queryFn: () => marketingApi.getTheme('draft'),
    });
    const tokens = (theme?.tokens ?? {});
    const saveMutation = useMutation({
        mutationFn: (body) => marketingApi.upsertTheme(body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'theme'] }),
    });
    if (isLoading)
        return _jsx("p", { className: "text-text-muted", children: "Loading theme\u2026" });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Theme editor" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Edit CSS design tokens for the marketing site." })] }), _jsxs("form", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", onSubmit: (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const next = { ...tokens };
                    for (const key of TOKEN_KEYS) {
                        const val = fd.get(key);
                        if (typeof val === 'string' && val)
                            next[key] = val;
                    }
                    saveMutation.mutate({ tokens: next, name: String(fd.get('name') ?? 'Default') });
                }, children: [_jsxs("label", { className: "sm:col-span-2 lg:col-span-3 block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Theme name" }), _jsx("input", { name: "name", defaultValue: String(theme?.name ?? 'Default'), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" })] }), TOKEN_KEYS.map((key) => (_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: key }), _jsxs("div", { className: "mt-1 flex gap-2", children: [_jsx("input", { type: "color", name: `${key}_picker`, defaultValue: tokens[key] ?? '#000000', onChange: (e) => {
                                            const input = e.currentTarget.form?.elements.namedItem(key);
                                            if (input)
                                                input.value = e.target.value;
                                        }, className: "h-10 w-12 cursor-pointer rounded border border-white/10" }), _jsx("input", { name: key, defaultValue: tokens[key] ?? '', className: "flex-1 rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono text-sm" })] })] }, key))), _jsx("div", { className: "sm:col-span-2 lg:col-span-3", children: _jsx("button", { type: "submit", disabled: saveMutation.isPending, className: "rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-60", children: "Save theme draft" }) })] })] }));
}

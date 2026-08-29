import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';
export function NavigationEditorPage() {
    const queryClient = useQueryClient();
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['marketing', 'nav'],
        queryFn: () => marketingApi.listNav('draft'),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, body }) => marketingApi.updateNav(id, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'nav'] }),
    });
    if (isLoading)
        return _jsx("p", { className: "text-text-muted", children: "Loading navigation\u2026" });
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Navigation" }), _jsx("div", { className: "space-y-3", children: items.map((item) => (_jsxs("form", { className: "flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-bg-card p-4", onSubmit: (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        updateMutation.mutate({
                            id: String(item.id),
                            body: { label: fd.get('label'), href: fd.get('href'), sortOrder: Number(fd.get('sortOrder')) },
                        });
                    }, children: [_jsxs("label", { className: "flex-1 min-w-[120px]", children: [_jsx("span", { className: "text-xs text-text-muted", children: "Label" }), _jsx("input", { name: "label", defaultValue: String(item.label), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" })] }), _jsxs("label", { className: "flex-[2] min-w-[160px]", children: [_jsx("span", { className: "text-xs text-text-muted", children: "Href" }), _jsx("input", { name: "href", defaultValue: String(item.href), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" })] }), _jsxs("label", { className: "w-20", children: [_jsx("span", { className: "text-xs text-text-muted", children: "Order" }), _jsx("input", { name: "sortOrder", type: "number", defaultValue: Number(item.sortOrder), className: "mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" })] }), _jsx("button", { type: "submit", className: "rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5", children: "Save" })] }, String(item.id)))) })] }));
}

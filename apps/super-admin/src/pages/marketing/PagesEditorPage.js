import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { marketingApi } from '@/lib/marketing-api';
export function PagesEditorPage() {
    const queryClient = useQueryClient();
    const [selectedSlug, setSelectedSlug] = useState('home');
    const [blockKey, setBlockKey] = useState('elevatorPitch');
    const [json, setJson] = useState('{\n  "title": "",\n  "body": ""\n}');
    const { data: pages = [], isLoading } = useQuery({
        queryKey: ['marketing', 'pages'],
        queryFn: () => marketingApi.listPages('draft'),
    });
    const saveMutation = useMutation({
        mutationFn: () => {
            const content = JSON.parse(json);
            return marketingApi.upsertPageBlock(selectedSlug, blockKey, content);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'pages'] }),
    });
    const page = pages.find((p) => p.slug === selectedSlug);
    const block = page?.blocks?.find((b) => b.blockKey === blockKey);
    function loadBlock(key) {
        setBlockKey(key);
        const existing = page?.blocks?.find((b) => b.blockKey === key);
        setJson(JSON.stringify(existing?.content ?? { title: '', body: '' }, null, 2));
    }
    if (isLoading)
        return _jsx("p", { className: "text-text-muted", children: "Loading pages\u2026" });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Pages & blocks" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Edit structured content blocks per page (draft)." })] }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [pages.map((p) => (_jsx("button", { type: "button", onClick: () => {
                            setSelectedSlug(p.slug);
                            loadBlock(blockKey);
                        }, className: `rounded-lg border px-4 py-2 text-sm ${selectedSlug === p.slug
                            ? 'border-brand-primary bg-brand-primary/10'
                            : 'border-white/10 hover:bg-white/5'}`, children: p.title || p.slug }, p.id))), _jsx("button", { type: "button", onClick: () => setSelectedSlug('home'), className: "rounded-lg border border-dashed border-white/20 px-4 py-2 text-sm text-text-muted", children: "+ home (on save)" })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[220px_1fr]", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium", children: "Block key" }), ['elevatorPitch', 'trustPillars', 'ctaBanner', 'featureIntro'].map((key) => (_jsx("button", { type: "button", onClick: () => loadBlock(key), className: `block w-full rounded-lg px-3 py-2 text-left text-sm ${blockKey === key ? 'bg-white/10' : 'hover:bg-white/5'}`, children: key }, key))), block ? (_jsx("p", { className: "pt-2 text-xs text-text-muted", children: "Editing existing draft block" })) : (_jsx("p", { className: "pt-2 text-xs text-text-muted", children: "New block will be created on save" }))] }), _jsxs("form", { className: "space-y-3 rounded-xl border border-white/10 bg-bg-card p-5", onSubmit: (e) => {
                            e.preventDefault();
                            saveMutation.mutate();
                        }, children: [_jsxs("p", { className: "text-sm text-text-muted", children: ["Page: ", _jsx("span", { className: "text-text-primary", children: selectedSlug }), " \u00B7 Block:", ' ', _jsx("span", { className: "text-text-primary", children: blockKey })] }), _jsx("textarea", { value: json, onChange: (e) => setJson(e.target.value), rows: 16, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono text-xs" }), _jsx("button", { type: "submit", disabled: saveMutation.isPending, className: "rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium disabled:opacity-60", children: saveMutation.isPending ? 'Saving…' : 'Save block' }), saveMutation.error ? (_jsx("p", { className: "text-sm text-status-error", children: String(saveMutation.error.message) })) : null] })] })] }));
}

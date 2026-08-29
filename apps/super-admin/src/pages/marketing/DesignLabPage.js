import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MARKETING_IMAGE_SLOTS, marketingApi } from '@/lib/marketing-api';
export function DesignLabPage() {
    const queryClient = useQueryClient();
    const [tone, setTone] = useState('friendly');
    const [slotKey, setSlotKey] = useState('heroRestaurant');
    const [copyPage, setCopyPage] = useState('home');
    const { data: presets = [] } = useQuery({
        queryKey: ['marketing', 'presets'],
        queryFn: marketingApi.listPresets,
    });
    const applyMutation = useMutation({
        mutationFn: marketingApi.applyPreset,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'theme'] }),
    });
    const seedPresetsMutation = useMutation({
        mutationFn: marketingApi.seedPresets,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'presets'] }),
    });
    const copyQuery = useQuery({
        queryKey: ['marketing', 'suggest-copy', copyPage, tone],
        queryFn: () => marketingApi.suggestCopy(copyPage, tone),
        enabled: false,
    });
    const promptQuery = useQuery({
        queryKey: ['marketing', 'suggest-prompt', slotKey, tone],
        queryFn: () => marketingApi.suggestImagePrompt(slotKey, tone),
        enabled: false,
    });
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Design lab" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Apply theme presets, get copy suggestions, and copy AI image prompts." })] }), _jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("h2", { className: "text-lg font-medium", children: "Theme presets" }), _jsx("button", { type: "button", onClick: () => seedPresetsMutation.mutate(), className: "rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5", children: "Seed presets" })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-3", children: presets.map((preset) => (_jsxs("div", { className: "rounded-xl border border-white/10 bg-bg-card p-4", children: [_jsx("p", { className: "font-medium", children: String(preset.name) }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: String(preset.description ?? '') }), _jsxs("p", { className: "mt-2 text-xs text-text-muted", children: ["Tone: ", String(preset.copyTone)] }), _jsx("button", { type: "button", onClick: () => applyMutation.mutate(String(preset.slug)), disabled: applyMutation.isPending, className: "mt-3 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-text-primary disabled:opacity-60", children: "Apply to theme draft" })] }, String(preset.slug)))) })] }), _jsxs("section", { className: "rounded-xl border border-white/10 bg-bg-card p-5 space-y-4", children: [_jsx("h2", { className: "text-lg font-medium", children: "Copy suggestions" }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("select", { value: copyPage, onChange: (e) => setCopyPage(e.target.value), className: "rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm", children: [_jsx("option", { value: "home", children: "Home" }), _jsx("option", { value: "pricing", children: "Pricing" }), _jsx("option", { value: "features", children: "Features" })] }), _jsxs("select", { value: tone, onChange: (e) => setTone(e.target.value), className: "rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm", children: [_jsx("option", { value: "friendly", children: "Friendly" }), _jsx("option", { value: "formal", children: "Formal" }), _jsx("option", { value: "enterprise", children: "Enterprise" })] }), _jsx("button", { type: "button", onClick: () => copyQuery.refetch(), className: "rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5", children: "Generate suggestions" })] }), _jsx("div", { className: "space-y-3", children: (copyQuery.data ?? []).map((item) => (_jsxs("div", { className: "rounded-lg border border-white/5 bg-bg-elevated p-3 text-sm", children: [_jsx("p", { className: "font-medium", children: String(item.headline) }), _jsx("p", { className: "mt-1 text-text-secondary", children: String(item.subline) }), _jsxs("p", { className: "mt-1 text-xs text-text-muted", children: ["CTA: ", String(item.cta)] })] }, String(item.id)))) })] }), _jsxs("section", { className: "rounded-xl border border-white/10 bg-bg-card p-5 space-y-4", children: [_jsx("h2", { className: "text-lg font-medium", children: "Image prompt" }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx("select", { value: slotKey, onChange: (e) => setSlotKey(e.target.value), className: "rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm", children: MARKETING_IMAGE_SLOTS.map((slot) => (_jsx("option", { value: slot, children: slot }, slot))) }), _jsx("button", { type: "button", onClick: () => promptQuery.refetch(), className: "rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5", children: "Get prompt" })] }), promptQuery.data ? (_jsx("textarea", { readOnly: true, value: String(promptQuery.data.prompt ?? ''), rows: 4, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" })) : null] })] }));
}

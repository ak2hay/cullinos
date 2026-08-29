import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MARKETING_IMAGE_SLOTS, marketingApi } from '@/lib/marketing-api';
export function MediaLibraryPage() {
    const queryClient = useQueryClient();
    const [slotKey, setSlotKey] = useState('');
    const { data: assets = [], isLoading } = useQuery({
        queryKey: ['marketing', 'assets'],
        queryFn: marketingApi.listAssets,
    });
    const uploadMutation = useMutation({
        mutationFn: ({ file, slot }) => marketingApi.uploadAsset(file, slot || undefined),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
    });
    const deleteMutation = useMutation({
        mutationFn: marketingApi.deleteAsset,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Media library" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Upload and assign images to marketing slots." })] }), _jsxs("div", { className: "rounded-xl border border-white/10 bg-bg-card p-5", children: [_jsx("label", { className: "block text-sm text-text-secondary", children: "Image slot (optional)" }), _jsxs("select", { value: slotKey, onChange: (e) => setSlotKey(e.target.value), className: "mt-1 w-full max-w-md rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "General upload" }), MARKETING_IMAGE_SLOTS.map((slot) => (_jsx("option", { value: slot, children: slot }, slot)))] }), _jsxs("label", { className: "mt-4 block", children: [_jsx("span", { className: "text-sm text-text-secondary", children: "Upload file" }), _jsx("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/svg+xml", className: "mt-1 block w-full text-sm", onChange: (e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                        uploadMutation.mutate({ file, slot: slotKey || undefined });
                                } })] }), uploadMutation.isPending ? _jsx("p", { className: "mt-2 text-sm text-text-muted", children: "Uploading\u2026" }) : null] }), isLoading ? (_jsx("p", { className: "text-text-muted", children: "Loading assets\u2026" })) : (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: assets.map((asset) => (_jsxs("div", { className: "overflow-hidden rounded-xl border border-white/10 bg-bg-card", children: [_jsx("div", { className: "aspect-video bg-bg-elevated", children: _jsx("img", { src: String(asset.url), alt: String(asset.alt ?? asset.originalName), className: "h-full w-full object-cover" }) }), _jsxs("div", { className: "space-y-2 p-4", children: [_jsx("p", { className: "truncate text-sm font-medium", children: String(asset.originalName) }), _jsxs("p", { className: "text-xs text-text-muted", children: ["Slot: ", String(asset.slotKey ?? '—')] }), _jsx("button", { type: "button", onClick: () => deleteMutation.mutate(String(asset.id)), className: "text-xs text-status-error hover:underline", children: "Delete" })] })] }, String(asset.id)))) }))] }));
}

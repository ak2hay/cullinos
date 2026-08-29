import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';
export function HeroEditorPage() {
    const queryClient = useQueryClient();
    const { data: slides = [], isLoading } = useQuery({
        queryKey: ['marketing', 'hero'],
        queryFn: () => marketingApi.listHeroSlides('draft'),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, body }) => marketingApi.updateHeroSlide(id, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'hero'] }),
    });
    if (isLoading)
        return _jsx("p", { className: "text-text-muted", children: "Loading slides\u2026" });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Hero carousel" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Edit home page hero slides (draft)." })] }), _jsx("div", { className: "space-y-4", children: slides.map((slide) => (_jsxs("form", { className: "space-y-3 rounded-xl border border-white/10 bg-bg-card p-5", onSubmit: (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        updateMutation.mutate({
                            id: String(slide.id),
                            body: {
                                headline: fd.get('headline'),
                                headlineAccent: fd.get('headlineAccent'),
                                subline: fd.get('subline'),
                                imageKey: fd.get('imageKey'),
                            },
                        });
                    }, children: [_jsxs("p", { className: "text-sm font-medium text-text-muted", children: ["Slide ", Number(slide.sortOrder) + 1] }), _jsx("input", { name: "headline", defaultValue: String(slide.headline), className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("input", { name: "headlineAccent", defaultValue: String(slide.headlineAccent), placeholder: "Accent line", className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("textarea", { name: "subline", defaultValue: String(slide.subline), rows: 2, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("input", { name: "imageKey", defaultValue: String(slide.imageKey ?? ''), placeholder: "Image slot key (e.g. heroRestaurant)", className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("button", { type: "submit", className: "rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary", children: "Save slide" })] }, String(slide.id)))) })] }));
}

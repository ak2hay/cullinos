import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { marketingApi } from '@/lib/marketing-api';
export function BlogEditorPage() {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(null);
    const { data: posts = [], isLoading } = useQuery({
        queryKey: ['marketing', 'blog'],
        queryFn: () => marketingApi.listBlog('draft'),
    });
    const createMutation = useMutation({
        mutationFn: marketingApi.createBlog,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] });
            setEditing(null);
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, body }) => marketingApi.updateBlog(id, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] }),
    });
    const deleteMutation = useMutation({
        mutationFn: marketingApi.deleteBlog,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] }),
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Blog" }), _jsx("button", { type: "button", onClick: () => setEditing('new'), className: "rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary", children: "New post" })] }), editing === 'new' ? (_jsxs("form", { className: "space-y-3 rounded-xl border border-white/10 bg-bg-card p-5", onSubmit: (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createMutation.mutate({
                        slug: String(fd.get('slug')),
                        title: String(fd.get('title')),
                        excerpt: String(fd.get('excerpt')),
                        body: String(fd.get('body')),
                    });
                }, children: [_jsx("input", { name: "slug", placeholder: "slug", required: true, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("input", { name: "title", placeholder: "Title", required: true, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("input", { name: "excerpt", placeholder: "Excerpt", className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("textarea", { name: "body", placeholder: "Markdown body", rows: 8, required: true, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm font-mono" }), _jsx("button", { type: "submit", className: "rounded-lg bg-brand-primary px-4 py-2 text-sm", children: "Create draft" })] })) : null, isLoading ? (_jsx("p", { className: "text-text-muted", children: "Loading posts\u2026" })) : (_jsx("div", { className: "space-y-4", children: posts.map((post) => (_jsxs("form", { className: "space-y-3 rounded-xl border border-white/10 bg-bg-card p-5", onSubmit: (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        updateMutation.mutate({
                            id: String(post.id),
                            body: {
                                title: fd.get('title'),
                                excerpt: fd.get('excerpt'),
                                body: fd.get('body'),
                            },
                        });
                    }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: String(post.slug) }), _jsx("button", { type: "button", onClick: () => deleteMutation.mutate(String(post.id)), className: "text-xs text-status-error hover:underline", children: "Delete" })] }), _jsx("input", { name: "title", defaultValue: String(post.title), className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("input", { name: "excerpt", defaultValue: String(post.excerpt ?? ''), className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" }), _jsx("textarea", { name: "body", defaultValue: String(post.body), rows: 6, className: "w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm font-mono" }), _jsx("button", { type: "submit", className: "rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5", children: "Save" })] }, String(post.id)))) }))] }));
}

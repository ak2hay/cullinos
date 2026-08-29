import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MARKETING_WEB_URL, marketingApi } from '@/lib/marketing-api';
export function MarketingDashboardPage() {
    const queryClient = useQueryClient();
    const { data: site } = useQuery({ queryKey: ['marketing', 'site'], queryFn: marketingApi.getSite });
    const seedMutation = useMutation({
        mutationFn: marketingApi.seedFromCode,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing'] }),
    });
    const publishMutation = useMutation({
        mutationFn: marketingApi.publish,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing'] }),
    });
    const previewMutation = useMutation({
        mutationFn: marketingApi.previewToken,
        onSuccess: ({ token }) => {
            window.open(`${MARKETING_WEB_URL}?preview=${token}`, '_blank');
        },
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Marketing CMS" }), _jsx("p", { className: "mt-1 text-text-secondary", children: "Manage the public marketing site at cullinos.com \u2014 content, images, theme, and blog." })] }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: [
                    { to: '/marketing/media', label: 'Media library', desc: 'Upload and replace hero & mockup images' },
                    { to: '/marketing/hero', label: 'Hero carousel', desc: 'Edit home page slide copy and images' },
                    { to: '/marketing/pages', label: 'Pages & blocks', desc: 'Structured sections and copy blocks' },
                    { to: '/marketing/theme', label: 'Theme', desc: 'Colors, fonts, and brand tokens' },
                    { to: '/marketing/pricing', label: 'Pricing cards', desc: 'Marketing pricing display' },
                    { to: '/marketing/navigation', label: 'Navigation', desc: 'Header nav links' },
                    { to: '/marketing/blog', label: 'Blog', desc: 'Posts and cover images' },
                    { to: '/marketing/design-lab', label: 'Design lab', desc: 'Presets, prompts, and suggestions' },
                ].map((item) => (_jsxs(Link, { to: item.to, className: "rounded-xl border border-white/10 bg-bg-card p-5 transition hover:border-white/20", children: [_jsx("p", { className: "font-medium", children: item.label }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: item.desc })] }, item.to))) }), _jsxs("div", { className: "rounded-xl border border-white/10 bg-bg-card p-5", children: [_jsxs("p", { className: "text-sm text-text-muted", children: ["Last published:", ' ', site?.lastPublishedAt
                                ? new Date(String(site.lastPublishedAt)).toLocaleString()
                                : 'Never'] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-3", children: [_jsx("button", { type: "button", onClick: () => seedMutation.mutate(), disabled: seedMutation.isPending, className: "rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60", children: seedMutation.isPending ? 'Importing…' : 'Import from codebase' }), _jsx("button", { type: "button", onClick: () => previewMutation.mutate(), disabled: previewMutation.isPending, className: "rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60", children: "Preview draft site" }), _jsx("button", { type: "button", onClick: () => publishMutation.mutate(), disabled: publishMutation.isPending, className: "rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-60", children: publishMutation.isPending ? 'Publishing…' : 'Publish site' })] }), seedMutation.error ? (_jsx("p", { className: "mt-3 text-sm text-status-error", children: String(seedMutation.error.message) })) : null, publishMutation.error ? (_jsx("p", { className: "mt-3 text-sm text-status-error", children: String(publishMutation.error.message) })) : null] })] }));
}

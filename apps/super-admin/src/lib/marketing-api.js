import { DEFAULT_API_BASE } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';
const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;
async function request(path, options = {}) {
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    if (token)
        headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
export const marketingApi = {
    getSite: () => request('/super-admin/marketing/site'),
    updateSite: (body) => request('/super-admin/marketing/site', { method: 'PATCH', body: JSON.stringify(body) }),
    listAssets: () => request('/super-admin/marketing/assets'),
    uploadAsset: (file, slotKey, alt) => {
        const form = new FormData();
        form.append('file', file);
        if (slotKey)
            form.append('slotKey', slotKey);
        if (alt)
            form.append('alt', alt);
        return request('/super-admin/marketing/assets/upload', {
            method: 'POST',
            body: form,
        });
    },
    updateAsset: (id, body) => request(`/super-admin/marketing/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteAsset: (id) => request(`/super-admin/marketing/assets/${id}`, { method: 'DELETE' }),
    listHeroSlides: (status = 'draft') => request(`/super-admin/marketing/hero-slides?status=${status}`),
    createHeroSlide: (body) => request('/super-admin/marketing/hero-slides', { method: 'POST', body: JSON.stringify(body) }),
    updateHeroSlide: (id, body) => request(`/super-admin/marketing/hero-slides/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteHeroSlide: (id) => request(`/super-admin/marketing/hero-slides/${id}`, { method: 'DELETE' }),
    listNav: (status = 'draft') => request(`/super-admin/marketing/nav?status=${status}`),
    createNav: (body) => request('/super-admin/marketing/nav', { method: 'POST', body: JSON.stringify(body) }),
    updateNav: (id, body) => request(`/super-admin/marketing/nav/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteNav: (id) => request(`/super-admin/marketing/nav/${id}`, { method: 'DELETE' }),
    listPricing: (status = 'draft') => request(`/super-admin/marketing/pricing?status=${status}`),
    updatePricing: (id, body) => request(`/super-admin/marketing/pricing/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    listTestimonials: (status = 'draft') => request(`/super-admin/marketing/testimonials?status=${status}`),
    updateTestimonial: (id, body) => request(`/super-admin/marketing/testimonials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    }),
    listBlog: (status = 'draft') => request(`/super-admin/marketing/blog?status=${status}`),
    createBlog: (body) => request('/super-admin/marketing/blog', { method: 'POST', body: JSON.stringify(body) }),
    updateBlog: (id, body) => request(`/super-admin/marketing/blog/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteBlog: (id) => request(`/super-admin/marketing/blog/${id}`, { method: 'DELETE' }),
    listPages: (status = 'draft') => request(`/super-admin/marketing/pages?status=${status}`),
    upsertPageBlock: (slug, blockKey, content, sortOrder = 0) => request(`/super-admin/marketing/pages/${slug}/blocks/${blockKey}`, {
        method: 'PUT',
        body: JSON.stringify({ content, sortOrder }),
    }),
    getTheme: (status = 'draft') => request(`/super-admin/marketing/theme?status=${status}`),
    upsertTheme: (body) => request('/super-admin/marketing/theme', { method: 'PUT', body: JSON.stringify(body) }),
    listPresets: () => request('/super-admin/marketing/design-presets'),
    seedPresets: () => request('/super-admin/marketing/design-presets/seed', { method: 'POST' }),
    applyPreset: (slug) => request(`/super-admin/marketing/design-presets/${slug}/apply`, { method: 'POST' }),
    suggestCopy: (page, tone) => request('/super-admin/marketing/suggest/copy', {
        method: 'POST',
        body: JSON.stringify({ page, tone }),
    }),
    suggestImagePrompt: (slotKey, tone) => request('/super-admin/marketing/suggest/image-prompt', {
        method: 'POST',
        body: JSON.stringify({ slotKey, tone }),
    }),
    publish: () => request('/super-admin/marketing/publish', { method: 'POST' }),
    previewToken: () => request('/super-admin/marketing/preview-token', { method: 'POST' }),
    seedFromCode: () => request('/super-admin/marketing/seed-from-code', { method: 'POST' }),
};
export const MARKETING_IMAGE_SLOTS = [
    'heroRestaurant',
    'heroKitchen',
    'heroTeam',
    'aboutKitchen',
    'mockupPos',
    'mockupKds',
    'mockupWaiter',
    'mockupOrdering',
    'mockupAdmin',
    'mockupEnterprise',
    'flowCloud',
];
export const MARKETING_WEB_URL = import.meta.env.VITE_MARKETING_WEB_URL ?? 'http://localhost:5180';

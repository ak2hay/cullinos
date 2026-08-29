import { DEFAULT_API_BASE } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const marketingApi = {
  getSite: () => request<Record<string, unknown>>('/super-admin/marketing/site'),
  updateSite: (body: Record<string, unknown>) =>
    request('/super-admin/marketing/site', { method: 'PATCH', body: JSON.stringify(body) }),

  listAssets: () => request<Array<Record<string, unknown>>>('/super-admin/marketing/assets'),
  uploadAsset: (file: File, slotKey?: string, alt?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (slotKey) form.append('slotKey', slotKey);
    if (alt) form.append('alt', alt);
    return request<Record<string, unknown>>('/super-admin/marketing/assets/upload', {
      method: 'POST',
      body: form,
    });
  },
  updateAsset: (id: string, body: Record<string, unknown>) =>
    request(`/super-admin/marketing/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAsset: (id: string) =>
    request(`/super-admin/marketing/assets/${id}`, { method: 'DELETE' }),

  listHeroSlides: (status = 'draft') =>
    request<Array<Record<string, unknown>>>(`/super-admin/marketing/hero-slides?status=${status}`),
  createHeroSlide: (body: Record<string, unknown>) =>
    request('/super-admin/marketing/hero-slides', { method: 'POST', body: JSON.stringify(body) }),
  updateHeroSlide: (id: string, body: Record<string, unknown>) =>
    request(`/super-admin/marketing/hero-slides/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteHeroSlide: (id: string) =>
    request(`/super-admin/marketing/hero-slides/${id}`, { method: 'DELETE' }),

  listNav: (status = 'draft') =>
    request<Array<Record<string, unknown>>>(`/super-admin/marketing/nav?status=${status}`),
  createNav: (body: Record<string, unknown>) =>
    request('/super-admin/marketing/nav', { method: 'POST', body: JSON.stringify(body) }),
  updateNav: (id: string, body: Record<string, unknown>) =>
    request(`/super-admin/marketing/nav/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNav: (id: string) => request(`/super-admin/marketing/nav/${id}`, { method: 'DELETE' }),

  listPricing: (status = 'draft') =>
    request<Array<Record<string, unknown>>>(`/super-admin/marketing/pricing?status=${status}`),
  updatePricing: (id: string, body: Record<string, unknown>) =>
    request(`/super-admin/marketing/pricing/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  listTestimonials: (status = 'draft') =>
    request<Array<Record<string, unknown>>>(`/super-admin/marketing/testimonials?status=${status}`),
  updateTestimonial: (id: string, body: Record<string, unknown>) =>
    request(`/super-admin/marketing/testimonials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listBlog: (status = 'draft') =>
    request<Array<Record<string, unknown>>>(`/super-admin/marketing/blog?status=${status}`),
  createBlog: (body: Record<string, unknown>) =>
    request('/super-admin/marketing/blog', { method: 'POST', body: JSON.stringify(body) }),
  updateBlog: (id: string, body: Record<string, unknown>) =>
    request(`/super-admin/marketing/blog/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteBlog: (id: string) => request(`/super-admin/marketing/blog/${id}`, { method: 'DELETE' }),

  listPages: (status = 'draft') =>
    request<Array<Record<string, unknown>>>(`/super-admin/marketing/pages?status=${status}`),
  upsertPageBlock: (slug: string, blockKey: string, content: unknown, sortOrder = 0) =>
    request(`/super-admin/marketing/pages/${slug}/blocks/${blockKey}`, {
      method: 'PUT',
      body: JSON.stringify({ content, sortOrder }),
    }),

  getTheme: (status = 'draft') =>
    request<Record<string, unknown> | null>(`/super-admin/marketing/theme?status=${status}`),
  upsertTheme: (body: { tokens: Record<string, string>; name?: string }) =>
    request('/super-admin/marketing/theme', { method: 'PUT', body: JSON.stringify(body) }),

  listPresets: () =>
    request<Array<Record<string, unknown>>>('/super-admin/marketing/design-presets'),
  seedPresets: () =>
    request('/super-admin/marketing/design-presets/seed', { method: 'POST' }),
  applyPreset: (slug: string) =>
    request(`/super-admin/marketing/design-presets/${slug}/apply`, { method: 'POST' }),
  suggestCopy: (page: string, tone: string) =>
    request<Array<Record<string, unknown>>>('/super-admin/marketing/suggest/copy', {
      method: 'POST',
      body: JSON.stringify({ page, tone }),
    }),
  suggestImagePrompt: (slotKey: string, tone: string) =>
    request<Record<string, unknown>>('/super-admin/marketing/suggest/image-prompt', {
      method: 'POST',
      body: JSON.stringify({ slotKey, tone }),
    }),

  publish: () => request<{ ok: boolean; publishedAt: string }>('/super-admin/marketing/publish', { method: 'POST' }),
  previewToken: () => request<{ token: string }>('/super-admin/marketing/preview-token', { method: 'POST' }),
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
] as const;

export const MARKETING_WEB_URL = import.meta.env.VITE_MARKETING_WEB_URL ?? 'http://localhost:5180';

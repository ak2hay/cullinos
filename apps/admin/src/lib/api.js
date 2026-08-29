import { CULLINOS_BRAND } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
export class ApiRequestError extends Error {
    code;
    status;
    constructor(message, code, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'ApiRequestError';
    }
}
async function parseError(response) {
    try {
        const body = (await response.json());
        return new ApiRequestError(body.error?.message ?? 'Request failed', body.error?.code ?? 'UNKNOWN', response.status);
    }
    catch {
        return new ApiRequestError(response.statusText || 'Request failed', 'UNKNOWN', response.status);
    }
}
export async function apiRequest(path, options = {}, authenticated = true) {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (authenticated) {
        const token = useAuthStore.getState().accessToken;
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
    }
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });
    if (!response.ok) {
        throw await parseError(response);
    }
    if (response.status === 204) {
        return undefined;
    }
    return response.json();
}
export const authApi = {
    login: (payload) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) }, false),
    register: (payload) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) }, false),
    logout: (refreshToken) => apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
    }),
};
export const outletsApi = {
    list: () => apiRequest('/outlets'),
};
export const analyticsApi = {
    daily: (params) => {
        const search = new URLSearchParams();
        if (params?.date)
            search.set('date', params.date);
        if (params?.outletId)
            search.set('outletId', params.outletId);
        const qs = search.toString();
        return apiRequest(`/analytics/daily${qs ? `?${qs}` : ''}`);
    },
};
export const menuApi = {
    listCategories: () => apiRequest('/menu/categories'),
    createCategory: (payload) => apiRequest('/menu/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    updateCategory: (id, payload) => apiRequest(`/menu/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    }),
    deleteCategory: (id) => apiRequest(`/menu/categories/${id}`, { method: 'DELETE' }),
    listItems: () => apiRequest('/menu/items'),
    createItem: (payload) => apiRequest('/menu/items', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    updateItem: (id, payload) => apiRequest(`/menu/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    }),
    deleteItem: (id) => apiRequest(`/menu/items/${id}`, { method: 'DELETE' }),
    getOutletMenu: (outletId) => apiRequest(`/menu/outlets/${outletId}`),
};
export const ordersApi = {
    list: (params) => {
        const search = new URLSearchParams();
        if (params?.outletId)
            search.set('outletId', params.outletId);
        if (params?.status)
            search.set('status', params.status);
        if (params?.limit)
            search.set('limit', String(params.limit));
        const qs = search.toString();
        return apiRequest(`/orders${qs ? `?${qs}` : ''}`);
    },
    get: (id) => apiRequest(`/orders/${id}`),
};
export const settingsApi = {
    get: () => apiRequest('/organizations/settings'),
    update: (settings) => apiRequest('/organizations/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings }),
    }),
};
export { CULLINOS_BRAND };

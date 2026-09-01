import { CULLINOS_BRAND, DEFAULT_API_BASE, mapStaffLoginResponse, } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';
const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;
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
    login: async (payload) => {
        const raw = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) }, false);
        return mapStaffLoginResponse(raw);
    },
    logout: (refreshToken) => apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
    }),
};
export const outletsApi = { list: () => apiRequest('/outlets'),
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
    update: async (data) => {
        const { businessType, name, gstin, operatingMode, enabledOrderTypes, sampleCategories, ...rest } = data;
        if (businessType || name || gstin) {
            await apiRequest('/organizations/current', {
                method: 'PATCH',
                body: JSON.stringify({ businessType, name, gstin }),
            });
        }
        const settings = {
            ...(operatingMode ? { operatingMode } : {}),
            ...(enabledOrderTypes ? { enabledOrderTypes } : {}),
            ...(sampleCategories ? { sampleCategories } : {}),
            ...rest,
        };
        return apiRequest('/organizations/settings', {
            method: 'PATCH',
            body: JSON.stringify({ settings }),
        });
    },
};
export const eventsApi = {
    list: (outletId) => {
        const qs = outletId ? `?outletId=${outletId}` : '';
        return apiRequest(`/events${qs}`);
    },
    create: (payload) => apiRequest('/events', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => apiRequest(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    delete: (id) => apiRequest(`/events/${id}`, { method: 'DELETE' }),
};
export const productionApi = {
    list: (outletId) => {
        const qs = outletId ? `?outletId=${outletId}` : '';
        return apiRequest(`/production${qs}`);
    },
    create: (payload) => apiRequest('/production', { method: 'POST', body: JSON.stringify(payload) }),
    complete: (id, actualQty) => apiRequest(`/production/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ actualQty }),
    }),
    scaleRecipe: (recipeId, factor) => apiRequest(`/production/recipes/${recipeId}/scale?factor=${factor}`),
};
export const loyaltyApi = {
    listTiers: () => apiRequest('/loyalty'),
    addStamp: (customerId) => apiRequest(`/loyalty/customers/${customerId}/stamp`, { method: 'POST' }),
};
export const couponsApi = {
    list: () => apiRequest('/coupons'),
    create: (payload) => apiRequest('/coupons', { method: 'POST', body: JSON.stringify(payload) }),
};
export const reportsApi = {
    smbSummary: (params) => {
        const search = new URLSearchParams();
        if (params?.outletId)
            search.set('outletId', params.outletId);
        if (params?.date)
            search.set('date', params.date);
        const qs = search.toString();
        return apiRequest(`/reports/smb-summary${qs ? `?${qs}` : ''}`);
    },
};
export const usersApi = {
    list: () => apiRequest('/users'),
    create: (payload) => apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    deactivate: (id) => apiRequest(`/users/${id}/deactivate`, { method: 'PATCH' }),
};
export const rolesApi = {
    list: () => apiRequest('/roles'),
};
export { CULLINOS_BRAND };

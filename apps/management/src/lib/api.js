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
};
export const brandsApi = {
    list: () => apiRequest('/brands'),
};
export const outletsApi = {
    list: (brandId) => {
        const qs = brandId ? `?brandId=${brandId}` : '';
        return apiRequest(`/outlets${qs}`);
    },
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
    outletComparison: (params) => {
        const search = new URLSearchParams();
        if (params?.date)
            search.set('date', params.date);
        if (params?.brandId)
            search.set('brandId', params.brandId);
        const qs = search.toString();
        return apiRequest(`/analytics/outlet-comparison${qs ? `?${qs}` : ''}`);
    },
};
export const inventoryApi = {
    listItems: () => apiRequest('/inventory/items'),
    transfer: (payload) => apiRequest('/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
};
export const franchiseApi = {
    listFranchisees: () => apiRequest('/franchise/franchisees'),
};
export const ordersApi = {
    list: (params) => {
        const search = new URLSearchParams();
        if (params?.outletId)
            search.set('outletId', params.outletId);
        if (params?.limit)
            search.set('limit', String(params.limit));
        const qs = search.toString();
        return apiRequest(`/orders${qs ? `?${qs}` : ''}`);
    },
};
export { CULLINOS_BRAND };

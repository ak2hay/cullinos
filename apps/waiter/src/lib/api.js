import { DEFAULT_API_BASE, mapStaffLoginResponse, } from '@cullinos/shared';
import { CULLINOS_BRAND } from '@cullinos/shared';
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
export const outletsApi = {
    list: () => apiRequest('/outlets'),
};
export const tablesApi = {
    list: (outletId) => apiRequest(`/tables/outlets/${outletId}`),
    updateStatus: (outletId, tableId, status) => apiRequest(`/tables/outlets/${outletId}/${tableId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    }),
};
export const ordersApi = {
    list: (params) => {
        const search = new URLSearchParams();
        if (params.outletId)
            search.set('outletId', params.outletId);
        if (params.tableId)
            search.set('tableId', params.tableId);
        if (params.status)
            search.set('status', params.status);
        const q = search.toString();
        return apiRequest(`/orders${q ? `?${q}` : ''}`);
    },
    get: (id) => apiRequest(`/orders/${id}`),
    create: (payload) => apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    addItems: (orderId, items) => apiRequest(`/orders/${orderId}/items`, {
        method: 'POST',
        body: JSON.stringify({ items }),
    }),
    confirm: (orderId) => apiRequest(`/orders/${orderId}/confirm`, { method: 'POST' }),
};
export const menuApi = {
    getOutletMenu: (outletId) => apiRequest(`/menu/outlets/${outletId}`),
};
export const posApi = {
    quickOrder: (payload) => apiRequest('/pos/quick-order', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
};
export { CULLINOS_BRAND };
export const TABLE_STATUS_COLORS = {
    AVAILABLE: 'bg-table-available',
    OCCUPIED: 'bg-table-occupied',
    RESERVED: 'bg-table-reserved',
    CLEANING: 'bg-table-cleaning',
    BILLING: 'bg-table-billing',
};

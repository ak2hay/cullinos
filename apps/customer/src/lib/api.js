import { CULLINOS_BRAND, DEFAULT_API_BASE } from '@cullinos/shared';
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
export async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
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
export const storefrontApi = {
    bootstrap: (orgSlug, outletSlug) => apiRequest(`/storefront/${orgSlug}/${outletSlug}`),
};
export const menuApi = {
    getOutletMenu: (outletId) => apiRequest(`/public/menu/outlets/${outletId}`),
};
export const ordersApi = {
    create: (payload) => apiRequest('/public/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    confirm: (orderId) => apiRequest(`/public/orders/${orderId}/confirm`, { method: 'POST' }),
};
export const tablesApi = {
    list: (outletId) => apiRequest(`/public/tables/outlets/${outletId}`),
};
export { CULLINOS_BRAND };
export function formatPrice(paise) {
    return `₹${(paise / 100).toFixed(0)}`;
}
export function hasApiAccess() {
    return true;
}

import { API_PREFIX, CULLINOS_BRAND } from '@cullinos/shared';
import { useAuthStore } from '../stores/auth';
const API_BASE = import.meta.env.VITE_API_URL ?? API_PREFIX;
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
    login: (payload) => apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
    }, false),
};
export const outletsApi = {
    list: () => apiRequest('/outlets'),
};
export const kitchenApi = {
    getDisplay: (outletId, stationId) => {
        const query = stationId ? `?stationId=${stationId}` : '';
        return apiRequest(`/kitchen/outlets/${outletId}/display${query}`);
    },
    updateItemStatus: (itemId, status) => apiRequest(`/kitchen/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    }),
};
export { CULLINOS_BRAND };

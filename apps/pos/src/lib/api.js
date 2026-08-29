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
};
export const outletsApi = {
    list: () => apiRequest('/outlets'),
};
export const menuApi = {
    getOutletMenu: (outletId) => apiRequest(`/menu/outlets/${outletId}`),
};
export const posApi = {
    quickOrder: (payload, idempotencyKey) => apiRequest('/pos/quick-order', {
        method: 'POST',
        body: JSON.stringify({ ...payload, autoConfirm: payload.autoConfirm ?? true }),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
    holdOrder: (orderId) => apiRequest(`/pos/orders/${orderId}/hold`, { method: 'POST' }),
    resumeOrder: (orderId) => apiRequest(`/pos/orders/${orderId}/resume`, { method: 'POST' }),
};
export const ordersApi = {
    create: (payload, idempotencyKey) => apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
    hold: (orderId) => apiRequest(`/orders/${orderId}/hold`, { method: 'POST' }),
    resume: (orderId) => apiRequest(`/orders/${orderId}/resume`, { method: 'POST' }),
};
export { CULLINOS_BRAND };

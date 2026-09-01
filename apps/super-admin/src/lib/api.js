import { DEFAULT_API_BASE } from '@cullinos/shared';
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
        if (body.error && typeof body.error === 'object' && body.error.message) {
            return new ApiRequestError(body.error.message, body.error.code ?? 'UNKNOWN', response.status);
        }
        if (body.message) {
            const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
            const code = typeof body.error === 'string' ? body.error : 'HTTP_ERROR';
            return new ApiRequestError(message, code, response.status);
        }
        return new ApiRequestError('Request failed', 'UNKNOWN', response.status);
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
export const superAdminApi = {
    login: (payload) => apiRequest('/super-admin/login', { method: 'POST', body: JSON.stringify(payload) }, false),
    listOrganizations: (page = 1, limit = 20) => apiRequest(`/super-admin/organizations?page=${page}&limit=${limit}`),
    suspendOrganization: (id, reason) => apiRequest(`/super-admin/organizations/${id}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    }),
    activateOrganization: (id) => apiRequest(`/super-admin/organizations/${id}/activate`, { method: 'PATCH' }),
    manageSubscription: (id, payload) => apiRequest(`/super-admin/organizations/${id}/subscription`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    }),
    listPlans: () => apiRequest('/super-admin/plans'),
    onboardRestaurant: (payload) => apiRequest('/super-admin/organizations', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
    health: () => apiRequest('/super-admin/health'),
};
export const RKYVES_BRAND = {
    name: 'Rkyves',
    product: 'Cullinos',
    tagline: 'Platform administration',
};

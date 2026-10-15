import {
  createSessionRefresher,
  resolveViteApiBase,
  revokeSessionCookie,
  type ApiStaffLoginResponse,
} from '@cullinos/shared';
import { askStepUp, cachedStepUpToken, clearStepUpToken } from '@/lib/step-up';
import { useSession, type SessionMode } from '@/stores/session';

export const API_BASE = resolveViteApiBase({
  viteApiUrl: import.meta.env.VITE_API_URL,
  isProd: import.meta.env.PROD,
});

/** Separate refresh cookies so a staff and a restaurant session never overwrite each other. */
const PORTAL_IDS: Record<SessionMode, string> = { agent: 'support-agent', customer: 'support' };

export function portalIdFor(mode: SessionMode) {
  return PORTAL_IDS[mode];
}

function applyRefresh(mode: SessionMode, raw: ApiStaffLoginResponse) {
  if (mode === 'agent' && !raw.user.isSuperAdmin) throw new Error('Not a platform session');
  if (mode === 'customer' && raw.user.isSuperAdmin) throw new Error('Not a restaurant session');
  useSession.getState().setToken(raw.accessToken ?? raw.token);
}

const refreshers: Record<SessionMode, () => Promise<boolean>> = {
  agent: createSessionRefresher({
    apiBase: API_BASE,
    portalId: PORTAL_IDS.agent,
    onRefreshed: (raw) => applyRefresh('agent', raw),
  }),
  customer: createSessionRefresher({
    apiBase: API_BASE,
    portalId: PORTAL_IDS.customer,
    onRefreshed: (raw) => applyRefresh('customer', raw),
  }),
};

useSession.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken && prev.mode) {
    revokeSessionCookie({ apiBase: API_BASE, portalId: PORTAL_IDS[prev.mode] });
  }
});

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function parseError(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      error?: string | { message?: string; code?: string };
    };
    if (body.error && typeof body.error === 'object' && body.error.message) {
      return new ApiRequestError(body.error.message, body.error.code ?? 'UNKNOWN', response.status);
    }
    if (body.message) {
      const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      return new ApiRequestError(message, typeof body.error === 'string' ? body.error : 'HTTP_ERROR', response.status);
    }
    return new ApiRequestError('Request failed', 'UNKNOWN', response.status);
  } catch {
    return new ApiRequestError(response.statusText || 'Request failed', 'UNKNOWN', response.status);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { session?: SessionMode } = {},
  authenticated = true,
  retried = false,
): Promise<T> {
  const { session: explicitMode, ...init } = options;
  const mode = explicitMode ?? useSession.getState().mode ?? 'customer';
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Cullinos-Portal', PORTAL_IDS[mode]);
  if (authenticated) {
    const token = useSession.getState().accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const stepUp = mode === 'agent' ? cachedStepUpToken() : null;
    if (stepUp && !headers.has('X-Step-Up-Token')) headers.set('X-Step-Up-Token', stepUp);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    const err = await parseError(response);
    if (err.status === 401 && authenticated && useSession.getState().accessToken) {
      if (!retried && (await refreshers[mode]())) {
        return apiRequest<T>(path, options, authenticated, true);
      }
      useSession.getState().logout();
    }
    if (authenticated && mode === 'agent' && err.code === 'STEP_UP_REQUIRED' && !new Headers(init.headers).has('X-Step-Up-Token')) {
      clearStepUpToken();
      const token = await askStepUp(err.message);
      if (!token) throw new ApiRequestError('Cancelled: identity not confirmed', 'CANCELLED', 403);
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set('X-Step-Up-Token', token);
      return apiRequest<T>(path, { ...options, headers: retryHeaders }, authenticated, retried);
    }
    throw err;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function json(method: string, body?: unknown): RequestInit {
  return { method, body: body === undefined ? '{}' : JSON.stringify(body) };
}

export function errorMessage(err: unknown): string | null {
  if (!err) return null;
  return err instanceof Error ? err.message : 'Something went wrong';
}

import type { ApiStaffLoginResponse } from './auth-client';

export interface SessionRefresherOptions {
  apiBase: string;
  portalId?: string;
  /** Path of the refresh endpoint relative to `apiBase`. */
  path?: string;
  onRefreshed: (response: ApiStaffLoginResponse) => void;
}

/**
 * Single-flight refresh of a staff session via the HttpOnly refresh cookie.
 * Concurrent 401s share one `POST /auth/refresh`; resolves false when the session is gone.
 */
export function createSessionRefresher(options: SessionRefresherOptions): () => Promise<boolean> {
  let inflight: Promise<boolean> | null = null;

  const run = async (): Promise<boolean> => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (options.portalId) headers['X-Cullinos-Portal'] = options.portalId;
      const response = await fetch(`${options.apiBase}${options.path ?? '/auth/refresh'}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: '{}',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return false;
      const body = (await response.json()) as ApiStaffLoginResponse;
      if (!body?.user || !(body.accessToken ?? body.token)) return false;
      options.onRefreshed(body);
      return true;
    } catch {
      return false;
    }
  };

  const refresh = () => {
    if (!inflight) {
      inflight = run().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
  return refresh;
}

/** Best-effort server-side sign-out: revokes the refresh cookie's session family. */
export function revokeSessionCookie(options: { apiBase: string; portalId?: string }): void {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.portalId) headers['X-Cullinos-Portal'] = options.portalId;
  void fetch(`${options.apiBase}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: '{}',
    keepalive: true,
  }).catch(() => undefined);
}

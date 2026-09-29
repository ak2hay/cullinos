import type { Request } from "express";

/** Proxy hops in front of the API (Traefik / nginx = 1). `0` disables trust. */
export function parseTrustProxyHops(raw: string | undefined): number {
  if (raw == null || raw.trim() === "") return 1;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

/**
 * Client IP as resolved by Express `trust proxy`. Never read X-Forwarded-For
 * directly: its leftmost entry is client-controlled.
 */
export function clientIp(req: Pick<Request, "ip">): string | undefined {
  return req.ip || undefined;
}

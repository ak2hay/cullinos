import type { Request, Response } from "express";
import { REFRESH_TTL_SECONDS } from "./session-tokens.service";

const COOKIE_PATH = "/api/v1/auth";

/** One cookie per portal so admin, POS and KDS sessions in one browser don't overwrite each other. */
export function refreshCookieName(req: Request): string {
  const raw = String(req.headers["x-cullinos-portal"] ?? "").toLowerCase();
  const portal = /^[a-z0-9_-]{1,32}$/.test(raw) ? raw : "default";
  return `cullinos_rt_${portal}`;
}

function cookieOptions() {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    ...(domain ? { domain } : {}),
  };
}

export function setRefreshCookie(req: Request, res: Response, token: string): void {
  res.cookie(refreshCookieName(req), token, {
    ...cookieOptions(),
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearRefreshCookie(req: Request, res: Response): void {
  res.clearCookie(refreshCookieName(req), cookieOptions());
}

export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const name = refreshCookieName(req);
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    const value = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(value) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Resolve absolute public URLs for marketing / menu uploads.
 * Relative `/cms/...` paths break when the admin SPA or guest app resolve them
 * against their own origins.
 */

/** API origin without `/api/v1` (e.g. https://api.cullinos.com). */
export function resolveApiPublicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const candidates = [
    env.API_PUBLIC_URL,
    env.PUBLIC_API_URL,
    env.MARKETING_PUBLIC_URL,
  ];
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      // If MARKETING_PUBLIC_URL is already .../cms, strip that path for origin.
      const path = u.pathname.replace(/\/$/, "");
      if (path === "/cms" || path.endsWith("/cms")) {
        return u.origin;
      }
      // Strip trailing /api/v1 if present.
      if (path === "/api/v1" || path.endsWith("/api/v1")) {
        return u.origin;
      }
      return u.origin;
    } catch {
      // ignore invalid
    }
  }
  if (env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  return null;
}

/**
 * Public base for local-disk marketing uploads (no trailing slash).
 * Prefer absolute MARKETING_PUBLIC_URL; else `{API origin}/cms`.
 */
export function resolveMarketingPublicBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.MARKETING_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (explicit && /^https?:\/\//i.test(explicit)) {
    return explicit;
  }
  const origin = resolveApiPublicOrigin(env);
  if (origin) {
    return `${origin}/cms`;
  }
  // Last resort — callers should still serve `/cms` on the API host.
  return explicit || "/cms";
}

/** Turn relative `/cms/...` (or other root-relative) URLs into absolute ones. */
export function normalizePublicAssetUrl(
  url: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (url == null) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    const origin = resolveApiPublicOrigin(env);
    if (origin) return `${origin}${trimmed}`;
  }
  return trimmed;
}

/**
 * Copy only allow-listed keys from a request body. Controllers that accept
 * `Record<string, unknown>` bypass ValidationPipe whitelisting, so services must never
 * spread raw bodies into Prisma `data` (that allows overriding organizationId etc.).
 */
export function pickDefined<K extends string>(
  source: Record<string, unknown> | null | undefined,
  keys: readonly K[],
): Partial<Record<K, unknown>> {
  const out: Partial<Record<K, unknown>> = {};
  if (!source || typeof source !== "object") return out;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

import { createHash } from "crypto";

const SECRET_KEY_RE = /pass(word)?|secret|token|otp|pin|api[-_]?key|private|cvv|card/i;
const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_KEYS = 50;

/** Copy of a request body that is safe to store: secrets masked, sizes capped. */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, MAX_KEYS).map((v) => redactForLog(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
    out[k] = SECRET_KEY_RE.test(k) ? "[redacted]" : redactForLog(v, depth + 1);
  }
  return out;
}

/** JSON with sorted keys so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export type ActivityHashFields = {
  userId: string | null;
  employeeCode: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  targetOrgId: string | null;
  statusCode: number | null;
  approvalRequestId: string | null;
  ticketId: string | null;
  grantId: string | null;
  diff: unknown;
  metadata: unknown;
  createdAt: string;
};

export function activityHash(prevHash: string | null, fields: ActivityHashFields): string {
  return createHash("sha256")
    .update(prevHash ?? "GENESIS")
    .update("|")
    .update(canonicalJson(fields))
    .digest("hex");
}

/** Walks rows in ascending seq order; returns the first row whose chain link is broken. */
export function verifyActivityChain(
  rows: readonly (ActivityHashFields & { id: string; prevHash: string | null; hash: string })[],
): { ok: boolean; checked: number; brokenAt: string | null } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0 && row.prevHash !== rows[i - 1].hash) {
      return { ok: false, checked: i, brokenAt: row.id };
    }
    const { id: _id, prevHash, hash, ...fields } = row;
    if (activityHash(prevHash, fields) !== hash) {
      return { ok: false, checked: i, brokenAt: row.id };
    }
  }
  return { ok: true, checked: rows.length, brokenAt: null };
}

const ORG_ROUTE_RE = /\/super-admin\/(?:organizations|tenants|orgs)\/([^/?]+)/;

/**
 * Turns `/api/v1/super-admin/organizations/:id/suspend` into a readable action and the
 * primary resource it touched.
 */
export function describeRoute(
  method: string,
  routePattern: string,
  params: Record<string, string> | undefined,
  url: string,
) {
  const pattern = routePattern.replace(/^\/?api\/v\d+/, "");
  const segments = pattern.split("/").filter(Boolean);
  const afterPrefix = segments[0] === "super-admin" ? segments.slice(1) : segments;
  const resourceType = afterPrefix.find((s) => !s.startsWith(":")) ?? null;
  const idParam = afterPrefix.find((s) => s.startsWith(":"));
  const resourceId = idParam ? (params?.[idParam.slice(1)] ?? null) : null;
  const orgMatch = ORG_ROUTE_RE.exec(url.split("?")[0] ?? "");
  return {
    action: `${method.toUpperCase()} ${pattern || url}`,
    resourceType,
    resourceId,
    targetOrgId: orgMatch?.[1] ?? null,
  };
}

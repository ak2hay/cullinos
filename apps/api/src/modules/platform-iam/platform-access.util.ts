import { isIP } from "net";
import {
  isPlatformPermission,
  isScopablePermission,
  normalizePlatformRole,
  permissionsForPlatformRole,
  type PlatformRoleName,
} from "../../common/platform-permissions";

export type ScopeType = "global" | "region" | "tenant_set";

export type ScopedGrant = {
  roleKey: string;
  scopeType: Exclude<ScopeType, "global">;
  scopeValues: string[];
  permissions: string[];
};

/** What a staff member may do right now, after expiry, IP and scope rules. */
export type EffectiveAccess = {
  primaryRole: PlatformRoleName;
  isOwner: boolean;
  roleKeys: string[];
  global: string[];
  scoped: ScopedGrant[];
};

export type AssignmentInput = {
  roleKey: string;
  permissions: string[];
  scopeType: ScopeType;
  scopeValues: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  roleIpAllowlist: string[];
};

export type AccessInput = {
  primaryRole: unknown;
  assignments: AssignmentInput[];
  /** Allowlist on the employee's team; empty means unrestricted. */
  teamIpAllowlist: string[];
  ip: string | undefined;
  now?: Date;
};

export class IpNotAllowedError extends Error {
  constructor() {
    super("Your network is not allowed to access the platform admin");
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.startsWith("::ffff:") && isIP(trimmed.slice(7)) === 4 ? trimmed.slice(7) : trimmed;
}

/** Exact IPs, or IPv4 CIDR blocks such as 10.0.0.0/8. */
export function ipMatchesAllowlist(ip: string | undefined, allowlist: readonly string[]): boolean {
  const rules = allowlist.map((r) => r.trim()).filter(Boolean);
  if (rules.length === 0) return true;
  if (!ip) return false;
  const addr = normalizeIp(ip);
  for (const rule of rules) {
    if (!rule.includes("/")) {
      if (normalizeIp(rule) === addr) return true;
      continue;
    }
    const [base, bitsRaw] = rule.split("/");
    const bits = Number(bitsRaw);
    const baseInt = ipv4ToInt(base);
    const addrInt = ipv4ToInt(addr);
    if (baseInt === null || addrInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      continue;
    }
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((baseInt & mask) >>> 0 === (addrInt & mask) >>> 0) return true;
  }
  return false;
}

/**
 * Effective access = primary system role (global) + active extra role assignments.
 * Assignments whose role has an IP allowlist only count from allowed networks; a team
 * allowlist blocks the whole session from anywhere else.
 */
export function computeEffectiveAccess(input: AccessInput): EffectiveAccess {
  if (!ipMatchesAllowlist(input.ip, input.teamIpAllowlist)) {
    throw new IpNotAllowedError();
  }
  const now = input.now ?? new Date();
  const primaryRole = normalizePlatformRole(input.primaryRole);
  const global = new Set<string>(permissionsForPlatformRole(primaryRole));
  const roleKeys = new Set<string>([primaryRole]);
  const scoped: ScopedGrant[] = [];

  for (const a of input.assignments) {
    if (a.revokedAt) continue;
    if (a.expiresAt && a.expiresAt.getTime() <= now.getTime()) continue;
    if (!ipMatchesAllowlist(input.ip, a.roleIpAllowlist)) continue;
    const perms = a.permissions.filter(isPlatformPermission);
    roleKeys.add(a.roleKey);
    if (a.scopeType === "global") {
      for (const p of perms) global.add(p);
      continue;
    }
    const scopablePerms = perms.filter(isScopablePermission);
    const values = a.scopeValues.map((v) => v.trim()).filter(Boolean);
    if (scopablePerms.length && values.length) {
      scoped.push({
        roleKey: a.roleKey,
        scopeType: a.scopeType,
        scopeValues: values,
        permissions: scopablePerms,
      });
    }
  }

  return {
    primaryRole,
    isOwner: primaryRole === "owner",
    roleKeys: [...roleKeys],
    global: [...global].sort(),
    scoped,
  };
}

/** Scoped grants that cover at least one of the required permissions. */
export function scopedGrantsFor(access: EffectiveAccess, required: readonly string[]): ScopedGrant[] {
  return access.scoped.filter((g) => required.some((p) => g.permissions.includes(p)));
}

export function grantCoversOrg(
  grant: ScopedGrant,
  org: { id: string; state: string | null },
): boolean {
  if (grant.scopeType === "tenant_set") return grant.scopeValues.includes(org.id);
  const region = org.state?.trim().toLowerCase();
  return Boolean(region) && grant.scopeValues.some((v) => v.toLowerCase() === region);
}

/** Prisma `where` fragment restricting organizations to what scoped grants cover. */
export function orgWhereForGrants(grants: readonly ScopedGrant[]) {
  const ids = grants.filter((g) => g.scopeType === "tenant_set").flatMap((g) => g.scopeValues);
  const regions = grants.filter((g) => g.scopeType === "region").flatMap((g) => g.scopeValues);
  const or: Record<string, unknown>[] = [];
  if (ids.length) or.push({ id: { in: ids } });
  for (const r of regions) or.push({ state: { equals: r, mode: "insensitive" } });
  return or.length ? { OR: or } : { id: { in: [] as string[] } };
}

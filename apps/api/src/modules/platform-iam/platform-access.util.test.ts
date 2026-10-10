import { describe, expect, it } from "vitest";
import {
  computeEffectiveAccess,
  grantCoversOrg,
  ipMatchesAllowlist,
  IpNotAllowedError,
  orgWhereForGrants,
  scopedGrantsFor,
  type AssignmentInput,
} from "./platform-access.util";

function assignment(over: Partial<AssignmentInput>): AssignmentInput {
  return {
    roleKey: "regional_ops",
    permissions: ["tenants.read", "tenants.suspend"],
    scopeType: "global",
    scopeValues: [],
    expiresAt: null,
    revokedAt: null,
    roleIpAllowlist: [],
    ...over,
  };
}

describe("ipMatchesAllowlist", () => {
  it("allows everything when the list is empty", () => {
    expect(ipMatchesAllowlist(undefined, [])).toBe(true);
  });

  it("matches exact IPs, IPv4 CIDR and IPv4-mapped IPv6", () => {
    expect(ipMatchesAllowlist("10.1.2.3", ["10.0.0.0/8"])).toBe(true);
    expect(ipMatchesAllowlist("::ffff:10.1.2.3", ["10.0.0.0/8"])).toBe(true);
    expect(ipMatchesAllowlist("203.0.113.9", ["203.0.113.9"])).toBe(true);
    expect(ipMatchesAllowlist("11.0.0.1", ["10.0.0.0/8"])).toBe(false);
    expect(ipMatchesAllowlist(undefined, ["10.0.0.0/8"])).toBe(false);
  });
});

describe("computeEffectiveAccess", () => {
  it("starts from the primary role", () => {
    const a = computeEffectiveAccess({ primaryRole: "viewer", assignments: [], teamIpAllowlist: [], ip: "1.1.1.1" });
    expect(a.isOwner).toBe(false);
    expect(a.global).toContain("tenants.read");
    expect(a.global).not.toContain("tenants.delete");
  });

  it("adds global assignments and skips expired or revoked ones", () => {
    const now = new Date("2026-10-08T00:00:00Z");
    const a = computeEffectiveAccess({
      primaryRole: "viewer",
      assignments: [
        assignment({ permissions: ["tenants.suspend"] }),
        assignment({ roleKey: "old", permissions: ["wallet.manage"], expiresAt: new Date("2026-10-07T00:00:00Z") }),
        assignment({ roleKey: "gone", permissions: ["labs.sql"], revokedAt: new Date() }),
      ],
      teamIpAllowlist: [],
      ip: "1.1.1.1",
      now,
    });
    expect(a.global).toContain("tenants.suspend");
    expect(a.global).not.toContain("wallet.manage");
    expect(a.global).not.toContain("labs.sql");
  });

  it("keeps only scopable permissions on scoped grants", () => {
    const a = computeEffectiveAccess({
      primaryRole: "viewer",
      assignments: [
        assignment({ scopeType: "region", scopeValues: ["Karnataka"], permissions: ["tenants.suspend", "labs.sql"] }),
      ],
      teamIpAllowlist: [],
      ip: "1.1.1.1",
    });
    expect(a.scoped).toEqual([
      { roleKey: "regional_ops", scopeType: "region", scopeValues: ["Karnataka"], permissions: ["tenants.suspend"] },
    ]);
    expect(a.global).not.toContain("labs.sql");
  });

  it("drops a role outside its IP allowlist and blocks outside the team allowlist", () => {
    const a = computeEffectiveAccess({
      primaryRole: "viewer",
      assignments: [assignment({ permissions: ["wallet.manage"], roleIpAllowlist: ["10.0.0.0/8"] })],
      teamIpAllowlist: [],
      ip: "1.1.1.1",
    });
    expect(a.global).not.toContain("wallet.manage");
    expect(() =>
      computeEffectiveAccess({ primaryRole: "owner", assignments: [], teamIpAllowlist: ["10.0.0.1"], ip: "1.1.1.1" }),
    ).toThrow(IpNotAllowedError);
  });
});

describe("scope helpers", () => {
  const region = { roleKey: "r", scopeType: "region" as const, scopeValues: ["Karnataka"], permissions: ["tenants.read"] };
  const set = { roleKey: "t", scopeType: "tenant_set" as const, scopeValues: ["org_1"], permissions: ["tenants.suspend"] };

  it("matches orgs by region (case-insensitive) or id", () => {
    expect(grantCoversOrg(region, { id: "x", state: "karnataka" })).toBe(true);
    expect(grantCoversOrg(region, { id: "x", state: null })).toBe(false);
    expect(grantCoversOrg(set, { id: "org_1", state: null })).toBe(true);
  });

  it("filters grants by required permission", () => {
    const access = { primaryRole: "viewer" as const, isOwner: false, roleKeys: [], global: [], scoped: [region, set] };
    expect(scopedGrantsFor(access, ["tenants.suspend"])).toEqual([set]);
  });

  it("builds a where clause that matches nothing when there are no grants", () => {
    expect(orgWhereForGrants([])).toEqual({ id: { in: [] } });
    expect(orgWhereForGrants([region, set])).toEqual({
      OR: [{ id: { in: ["org_1"] } }, { state: { equals: "Karnataka", mode: "insensitive" } }],
    });
  });
});

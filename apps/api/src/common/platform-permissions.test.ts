import { describe, expect, it } from "vitest";
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
  PLATFORM_ROLE_PERMISSIONS,
  normalizePlatformRole,
  permissionsForPlatformRole,
  requiresActionTicket,
} from "./platform-permissions";

const OWNER_ONLY = ["tenants.delete", "labs.sql", "settings.manage", "team.manage"] as const;

describe("platform role permissions", () => {
  it("gives owner every permission", () => {
    expect(new Set(permissionsForPlatformRole("owner"))).toEqual(new Set(PLATFORM_PERMISSIONS));
  });

  it.each(PLATFORM_ROLES.filter((r) => r !== "owner"))(
    "keeps owner-only permissions away from %s",
    (role) => {
      const perms = permissionsForPlatformRole(role);
      for (const p of OWNER_ONLY) expect(perms).not.toContain(p);
    },
  );

  it("only maps to known permissions", () => {
    for (const perms of Object.values(PLATFORM_ROLE_PERMISSIONS)) {
      for (const p of perms) expect(PLATFORM_PERMISSIONS).toContain(p);
    }
  });

  it("treats missing or unknown roles as viewer", () => {
    expect(normalizePlatformRole(null)).toBe("viewer");
    expect(normalizePlatformRole("root")).toBe("viewer");
    expect(permissionsForPlatformRole(undefined)).toEqual([...PLATFORM_ROLE_PERMISSIONS.viewer]);
  });

  it("support can impersonate but not change plans or settings", () => {
    const perms = permissionsForPlatformRole("support");
    expect(perms).toContain("tenants.impersonate");
    expect(perms).not.toContain("plans.manage");
    expect(perms).not.toContain("wallet.manage");
  });

  it("marketing cannot touch tenants", () => {
    const perms = permissionsForPlatformRole("marketing");
    expect(perms.some((p) => p.startsWith("tenants."))).toBe(false);
  });

  it("requires a support ticket for every role except owner", () => {
    expect(requiresActionTicket("owner")).toBe(false);
    for (const role of PLATFORM_ROLES) {
      if (role === "owner") continue;
      expect(requiresActionTicket(role)).toBe(true);
    }
    expect(requiresActionTicket(null)).toBe(true);
    expect(requiresActionTicket(undefined)).toBe(true);
  });
});

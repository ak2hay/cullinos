import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { assertPlatformAccess } from "./platform-access.util";
import { SuperAdminGuard } from "./super-admin.guard";

function reflector(required?: string[], isPublic = false): Reflector {
  return {
    getAllAndOverride: (key: string) => (key === "isPublic" ? isPublic : required),
  } as unknown as Reflector;
}

function ctx(user?: Record<string, unknown>, path = "/api/v1/super-admin/organizations") {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ path, user }) }),
  } as unknown as ExecutionContext;
}

describe("assertPlatformAccess", () => {
  it("rejects non super admins", () => {
    expect(() =>
      assertPlatformAccess(reflector(["tenants.read"]), ctx(), { platformRole: "owner" }),
    ).toThrow(ForbiddenException);
  });

  it("asks legacy tokens without a role to refresh", () => {
    expect(() =>
      assertPlatformAccess(reflector(["tenants.read"]), ctx(), { isSuperAdmin: true }),
    ).toThrow(UnauthorizedException);
  });

  it("allows a role that has one of the required permissions", () => {
    expect(() =>
      assertPlatformAccess(reflector(["tenants.read"]), ctx(), {
        isSuperAdmin: true,
        platformRole: "viewer",
      }),
    ).not.toThrow();
  });

  it("blocks a role without the permission", () => {
    expect(() =>
      assertPlatformAccess(reflector(["tenants.delete"]), ctx(), {
        isSuperAdmin: true,
        platformRole: "support",
      }),
    ).toThrow(ForbiddenException);
  });

  it("ignores a forged permissions claim and uses the role", () => {
    expect(() =>
      assertPlatformAccess(reflector(["labs.sql"]), ctx(), {
        isSuperAdmin: true,
        platformRole: "viewer",
        platformPermissions: ["labs.sql"],
      } as never),
    ).toThrow(ForbiddenException);
  });

  it("treats undecorated routes as owner-only", () => {
    const user = { isSuperAdmin: true, platformRole: "finance" };
    expect(() => assertPlatformAccess(reflector(undefined), ctx(), user)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertPlatformAccess(reflector(undefined), ctx(), { isSuperAdmin: true, platformRole: "owner" }),
    ).not.toThrow();
  });
});

describe("SuperAdminGuard (global)", () => {
  it("ignores non super-admin paths", () => {
    const guard = new SuperAdminGuard(reflector(undefined));
    expect(guard.canActivate(ctx(undefined, "/api/v1/orders"))).toBe(true);
  });

  it("skips public super-admin routes such as login", () => {
    const guard = new SuperAdminGuard(reflector(undefined, true));
    expect(guard.canActivate(ctx(undefined, "/api/v1/super-admin/login"))).toBe(true);
  });

  it("enforces role permissions on super-admin paths", () => {
    const guard = new SuperAdminGuard(reflector(["plans.manage"]));
    expect(() =>
      guard.canActivate(ctx({ isSuperAdmin: true, platformRole: "sales" })),
    ).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx({ isSuperAdmin: true, platformRole: "finance" }))).toBe(true);
  });
});

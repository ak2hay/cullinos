import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { assertPlatformAccess } from "./platform-access.util";
import { SuperAdminGuard } from "./super-admin.guard";
import type { PlatformAuthorizationService } from "../modules/platform-iam/platform-authorization.service";

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

function guardFor(r: Reflector) {
  const calls: unknown[] = [];
  const authz = {
    authorize: async (context: ExecutionContext, request: { user?: Record<string, unknown> }) => {
      calls.push(request);
      assertPlatformAccess(r, context, request.user as never);
    },
  } as unknown as PlatformAuthorizationService;
  return { guard: new SuperAdminGuard(r, authz), calls };
}

describe("SuperAdminGuard (global)", () => {
  it("ignores non super-admin paths", async () => {
    const { guard, calls } = guardFor(reflector(undefined));
    await expect(guard.canActivate(ctx(undefined, "/api/v1/orders"))).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("skips public super-admin routes such as login", async () => {
    const { guard, calls } = guardFor(reflector(undefined, true));
    await expect(guard.canActivate(ctx(undefined, "/api/v1/super-admin/login"))).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("delegates super-admin paths to platform authorization", async () => {
    const { guard } = guardFor(reflector(["plans.manage"]));
    await expect(guard.canActivate(ctx({ isSuperAdmin: true, platformRole: "sales" }))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(ctx({ isSuperAdmin: true, platformRole: "finance" }))).resolves.toBe(true);
  });
});

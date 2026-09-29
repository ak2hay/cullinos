import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";
import { JwtAuthGuard, isStaffAccessPayload } from "./jwt-auth.guard";
import { getJwtSecret } from "./jwt-secret.util";
import { PLATFORM_AUDIENCE, getSuperAdminJwtSecret } from "./access-token.util";

const jwt = new JwtService({ secret: getJwtSecret() });

function guard(isPublic = false) {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  return new JwtAuthGuard(jwt, reflector);
}

function ctx(token?: string) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("isStaffAccessPayload", () => {
  it("accepts staff and impersonation access tokens", () => {
    expect(isStaffAccessPayload({ sub: "u1", organizationId: "org_1", permissions: [] })).toBe(true);
    expect(
      isStaffAccessPayload({ sub: "u1", organizationId: "org_1", impersonation: true }),
    ).toBe(true);
  });

  it("rejects typed, preview and org-less tokens", () => {
    expect(isStaffAccessPayload({ sub: "g1", type: "guest", phone: "" })).toBe(false);
    expect(isStaffAccessPayload({ sub: "c1", type: "customer", orgId: "org_1" })).toBe(false);
    expect(isStaffAccessPayload({ sub: "u1", type: "refresh" })).toBe(false);
    expect(isStaffAccessPayload({ sub: "u1", organizationId: "org_1", type: "refresh" })).toBe(false);
    expect(isStaffAccessPayload({ sub: "u1", type: "otp_challenge" })).toBe(false);
    expect(isStaffAccessPayload({ preview: true, scope: "marketing" })).toBe(false);
    expect(isStaffAccessPayload({ sub: "u1" })).toBe(false);
    expect(isStaffAccessPayload({ sub: "u1", organizationId: "" })).toBe(false);
  });
});

describe("JwtAuthGuard", () => {
  it("lets a staff token through and sets request.user", () => {
    const { context, request } = ctx(jwt.sign({ sub: "u1", organizationId: "org_1" }));
    expect(guard().canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ sub: "u1", organizationId: "org_1" });
  });

  it("rejects a Cullinos App guest token on staff routes", () => {
    const { context } = ctx(jwt.sign({ sub: "g1", type: "guest", phone: "+919999999999" }));
    expect(() => guard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects refresh and customer tokens on staff routes", () => {
    for (const payload of [
      { sub: "u1", type: "refresh" },
      { sub: "c1", type: "customer", orgId: "org_1", phone: "1" },
    ]) {
      const { context } = ctx(jwt.sign(payload));
      expect(() => guard().canActivate(context)).toThrow(UnauthorizedException);
    }
  });

  it("rejects a tenant-key token that claims super admin", () => {
    const { context } = ctx(jwt.sign({ sub: "u1", organizationId: "org_1", isSuperAdmin: true }));
    expect(() => guard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it("accepts super-admin tokens only from the platform key and audience", () => {
    const platform = jwt.sign(
      { sub: "sa", organizationId: "org_p", isSuperAdmin: true },
      { secret: getSuperAdminJwtSecret(), audience: PLATFORM_AUDIENCE },
    );
    const ok = ctx(platform);
    expect(guard().canActivate(ok.context)).toBe(true);
    expect(ok.request.user).toMatchObject({ sub: "sa", isSuperAdmin: true });

    const noAudience = jwt.sign(
      { sub: "sa", organizationId: "org_p", isSuperAdmin: true },
      { secret: getSuperAdminJwtSecret() },
    );
    expect(() => guard().canActivate(ctx(noAudience).context)).toThrow(UnauthorizedException);

    const notSuper = jwt.sign(
      { sub: "u1", organizationId: "org_1" },
      { secret: getSuperAdminJwtSecret(), audience: PLATFORM_AUDIENCE },
    );
    expect(() => guard().canActivate(ctx(notSuper).context)).toThrow(UnauthorizedException);
  });

  it("skips verification on public routes", () => {
    const { context } = ctx();
    expect(guard(true).canActivate(context)).toBe(true);
  });
});

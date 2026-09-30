import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccountStatusGuard } from "./account-status.guard";

function ctx(user: unknown) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

function guard(row: unknown) {
  const findUnique = vi.fn().mockResolvedValue(row);
  const g = new AccountStatusGuard(new Reflector(), { user: { findUnique } } as never);
  return { g, findUnique };
}

describe("AccountStatusGuard", () => {
  it("allows active users in active orgs", async () => {
    const { g } = guard({ tokenVersion: 0, status: "active", isSuperAdmin: false, organizationId: "o1", organization: { status: "active" } });
    await expect(g.canActivate(ctx({ sub: "u1", organizationId: "o1" }))).resolves.toBe(true);
  });

  it("rejects deactivated users", async () => {
    const { g } = guard({ tokenVersion: 0, status: "inactive", isSuperAdmin: false, organizationId: "o1", organization: { status: "active" } });
    await expect(g.canActivate(ctx({ sub: "u1", organizationId: "o1" }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects suspended organizations", async () => {
    const { g } = guard({ tokenVersion: 0, status: "active", isSuperAdmin: false, organizationId: "o1", organization: { status: "suspended" } });
    await expect(g.canActivate(ctx({ sub: "u1", organizationId: "o1" }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejects a token whose org no longer matches the user", async () => {
    const { g } = guard({ tokenVersion: 0, status: "active", isSuperAdmin: false, organizationId: "o2", organization: { status: "active" } });
    await expect(g.canActivate(ctx({ sub: "u1", organizationId: "o1" }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("lets super admins act inside other orgs", async () => {
    const { g } = guard({ tokenVersion: 0, status: "active", isSuperAdmin: true, organizationId: "platform", organization: { status: "active" } });
    await expect(g.canActivate(ctx({ sub: "sa", organizationId: "o1" }))).resolves.toBe(true);
  });

  it("rejects tokens issued before the user's session version was bumped", async () => {
    const { g } = guard({ tokenVersion: 2, status: "active", isSuperAdmin: false, organizationId: "o1", organization: { status: "active" } });
    await expect(g.canActivate(ctx({ sub: "u1", organizationId: "o1", tv: 1 }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(g.canActivate(ctx({ sub: "u1", organizationId: "o1", tv: 2 }))).resolves.toBe(true);
  });

  it("caches the verdict briefly", async () => {
    const { g, findUnique } = guard({ tokenVersion: 0, status: "active", isSuperAdmin: false, organizationId: "o1", organization: { status: "active" } });
    await g.canActivate(ctx({ sub: "u1", organizationId: "o1" }));
    await g.canActivate(ctx({ sub: "u1", organizationId: "o1" }));
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});

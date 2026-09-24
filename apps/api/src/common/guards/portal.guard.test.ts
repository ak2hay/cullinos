import { ServiceUnavailableException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { PortalStatusService } from "../../modules/platform-config/portal-status.service";
import { parsePortal } from "../portal-context";
import { PortalGuard } from "./portal.guard";

function makeGuard(enabled: { management: boolean; waiter: boolean }, allow = false) {
  const reflector = { getAllAndOverride: () => allow } as unknown as Reflector;
  const status = {
    getStatus: async () => ({
      portals: {
        management: { enabled: enabled.management },
        waiter: { enabled: enabled.waiter },
      },
      message: "off",
    }),
  } as unknown as PortalStatusService;
  return new PortalGuard(reflector, status);
}

function ctx(headers: Record<string, string>, user?: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ headers, user }) }),
  } as unknown as ExecutionContext;
}

describe("parsePortal", () => {
  it("accepts known portals case-insensitively", () => {
    expect(parsePortal(" Management ")).toBe("management");
    expect(parsePortal("waiter")).toBe("waiter");
  });

  it("ignores unknown or missing values", () => {
    expect(parsePortal("admin")).toBeNull();
    expect(parsePortal(undefined)).toBeNull();
    expect(parsePortal(42)).toBeNull();
  });
});

describe("PortalGuard", () => {
  it("allows requests without a portal", async () => {
    const guard = makeGuard({ management: false, waiter: false });
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });

  it("blocks a disabled portal from the header", async () => {
    const guard = makeGuard({ management: false, waiter: true });
    await expect(
      guard.canActivate(ctx({ "x-cullinos-portal": "management" })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("blocks a disabled portal from the JWT claim when the header is omitted", async () => {
    const guard = makeGuard({ management: true, waiter: false });
    await expect(guard.canActivate(ctx({}, { portal: "waiter" }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("lets enabled portals through", async () => {
    const guard = makeGuard({ management: true, waiter: true });
    await expect(guard.canActivate(ctx({ "x-cullinos-portal": "waiter" }))).resolves.toBe(true);
  });

  it("never blocks super admins or exempt routes", async () => {
    const off = { management: false, waiter: false };
    await expect(
      makeGuard(off).canActivate(ctx({ "x-cullinos-portal": "management" }, { isSuperAdmin: true })),
    ).resolves.toBe(true);
    await expect(
      makeGuard(off, true).canActivate(ctx({ "x-cullinos-portal": "management" })),
    ).resolves.toBe(true);
  });

  it("returns the PORTAL_DISABLED code for clients", async () => {
    const guard = makeGuard({ management: false, waiter: true });
    try {
      await guard.canActivate(ctx({ "x-cullinos-portal": "management" }));
      expect.unreachable();
    } catch (err) {
      const body = (err as ServiceUnavailableException).getResponse() as { code: string };
      expect(body.code).toBe("PORTAL_DISABLED");
    }
  });
});

import { ServiceUnavailableException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { PortalStatusService } from "../../modules/platform-config/portal-status.service";
import { SWITCHABLE_PORTALS, parsePortal } from "../portal-context";
import { PortalGuard } from "./portal.guard";

function emptyPortals(overrides: Record<string, { enabled: boolean; maintenanceMessage: string | null }> = {}) {
  const portals = {} as Record<
    string,
    { enabled: boolean; maintenanceMessage: string | null }
  >;
  for (const p of SWITCHABLE_PORTALS) {
    portals[p] = overrides[p] ?? { enabled: true, maintenanceMessage: null };
  }
  return portals;
}

function makeGuard(
  overrides: Record<string, { enabled: boolean; maintenanceMessage: string | null }> = {},
  allow = false,
) {
  const reflector = { getAllAndOverride: () => allow } as unknown as Reflector;
  const status = {
    getStatus: async () => ({
      portals: emptyPortals(overrides),
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
    expect(parsePortal("app_ops")).toBe("app_ops");
    expect(parsePortal("admin")).toBe("admin");
  });

  it("ignores unknown or missing values", () => {
    expect(parsePortal("platform")).toBeNull();
    expect(parsePortal(undefined)).toBeNull();
    expect(parsePortal(42)).toBeNull();
  });
});

describe("PortalGuard", () => {
  it("allows requests without a portal", async () => {
    const guard = makeGuard({ management: { enabled: false, maintenanceMessage: null } });
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });

  it("blocks a disabled portal from the header", async () => {
    const guard = makeGuard({ management: { enabled: false, maintenanceMessage: null } });
    await expect(
      guard.canActivate(ctx({ "x-cullinos-portal": "management" })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("blocks maintenance even when enabled", async () => {
    const guard = makeGuard({
      waiter: { enabled: true, maintenanceMessage: "Upgrading kitchen" },
    });
    try {
      await guard.canActivate(ctx({ "x-cullinos-portal": "waiter" }));
      expect.unreachable();
    } catch (err) {
      const body = (err as ServiceUnavailableException).getResponse() as { code: string };
      expect(body.code).toBe("PORTAL_MAINTENANCE");
    }
  });

  it("blocks a disabled portal from the JWT claim when the header is omitted", async () => {
    const guard = makeGuard({ waiter: { enabled: false, maintenanceMessage: null } });
    await expect(guard.canActivate(ctx({}, { portal: "waiter" }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("lets enabled portals through", async () => {
    const guard = makeGuard();
    await expect(guard.canActivate(ctx({ "x-cullinos-portal": "waiter" }))).resolves.toBe(true);
  });

  it("does not bypass declared portals for super admins", async () => {
    await expect(
      makeGuard({ app_ops: { enabled: false, maintenanceMessage: null } }).canActivate(
        ctx({ "x-cullinos-portal": "app_ops" }, { isSuperAdmin: true }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("allows exempt routes", async () => {
    await expect(
      makeGuard({ management: { enabled: false, maintenanceMessage: null } }, true).canActivate(
        ctx({ "x-cullinos-portal": "management" }),
      ),
    ).resolves.toBe(true);
  });

  it("returns the PORTAL_DISABLED code for clients", async () => {
    const guard = makeGuard({ management: { enabled: false, maintenanceMessage: null } });
    try {
      await guard.canActivate(ctx({ "x-cullinos-portal": "management" }));
      expect.unreachable();
    } catch (err) {
      const body = (err as ServiceUnavailableException).getResponse() as { code: string };
      expect(body.code).toBe("PORTAL_DISABLED");
    }
  });
});

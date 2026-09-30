import { describe, expect, it, vi } from "vitest";
import { OrganizationsService } from "./organizations.service";

function serviceFor(businessType: string, existingSettings: Record<string, unknown> = {}) {
  let stored: Record<string, unknown> = existingSettings;
  const prisma = {
    organizationSettings: {
      findUnique: vi.fn(async () => ({ settings: stored })),
      upsert: vi.fn(async (args: { update: { settings: Record<string, unknown> } }) => {
        stored = args.update.settings;
        return { organizationId: "org_1", settings: stored };
      }),
    },
    organization: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        expect(args.where.id).toBe("org_1");
        return { businessType, settings: { settings: stored } };
      }),
    },
    outlet: {
      findMany: vi.fn(async (args: { where: { organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return [{ id: "o1" }, { id: "o2" }];
      }),
    },
    kitchenStation: { upsert: vi.fn(async () => ({})) },
  };
  const service = new OrganizationsService(prisma as never, {} as never);
  return { service, prisma };
}

describe("OrganizationsService.updateSettings bar station", () => {
  it("creates a Bar station at every outlet when a restaurant turns on alcohol", async () => {
    const { service, prisma } = serviceFor("restaurant");
    await service.updateSettings("org_1", { settings: { servesAlcohol: true } });

    expect(prisma.kitchenStation.upsert).toHaveBeenCalledTimes(2);
    const outletIds = prisma.kitchenStation.upsert.mock.calls.map(
      (call) => (call as unknown as [{ create: { outletId: string; code: string } }])[0].create,
    );
    expect(outletIds).toEqual([
      expect.objectContaining({ outletId: "o1", code: "BAR" }),
      expect.objectContaining({ outletId: "o2", code: "BAR" }),
    ]);
  });

  it("does not create a station for a cloud kitchen even if the flag is sent", async () => {
    const { service, prisma } = serviceFor("cloud_kitchen");
    await service.updateSettings("org_1", { settings: { servesAlcohol: true } });
    expect(prisma.kitchenStation.upsert).not.toHaveBeenCalled();
  });

  it("does not create a station when alcohol stays off", async () => {
    const { service, prisma } = serviceFor("restaurant");
    await service.updateSettings("org_1", { settings: { servesAlcohol: "yes" } });
    expect(prisma.organizationSettings.upsert.mock.calls[0]?.[0]).toMatchObject({
      update: { settings: { servesAlcohol: false } },
    });
    expect(prisma.kitchenStation.upsert).not.toHaveBeenCalled();
  });
});

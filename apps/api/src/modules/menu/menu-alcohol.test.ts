import { describe, expect, it, vi } from "vitest";
import { MenuService } from "./menu.service";

function item(id: string, productType: string | null) {
  return {
    id,
    name: id,
    description: null,
    productType,
    basePrice: 150,
    packagingCharge: 0,
    categoryId: "c1",
    imageUrl: null,
    isVeg: productType !== "alcohol",
    isSpecial: false,
    allergens: [],
    stockBasedAvailability: false,
    variants: [],
    modifierGroups: [],
    outletPrices: [],
    recipe: null,
  };
}

function serviceFor(businessType: string, settings: Record<string, unknown> = {}) {
  const prisma = {
    outlet: {
      findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return { id: args.where.id, operatingMode: "full_service" };
      }),
    },
    organization: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        expect(args.where.id).toBe("org_1");
        return { businessType, timezone: "Asia/Kolkata", settings: { settings } };
      }),
    },
    menuSchedule: { findMany: vi.fn(async () => []) },
    menuCategory: {
      findMany: vi.fn(async () => [{ id: "c1", name: "Drinks", description: null }]),
    },
    menuItem: {
      findMany: vi.fn(async (args: { where: { organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return [item("fries", null), item("beer", "alcohol")];
      }),
    },
    happyHourRule: { findMany: vi.fn(async () => []) },
  };
  return new MenuService(prisma as never, {} as never);
}

describe("MenuService.getOutletMenu alcohol", () => {
  it("hides drinks when the restaurant does not serve alcohol", async () => {
    const menu = await serviceFor("restaurant").getOutletMenu("org_1", "o1");
    expect(menu.items.map((i) => i.id)).toEqual(["fries"]);
    expect(menu.alcohol).toEqual({ served: false, dineInOnly: true });
  });

  it("shows drinks flagged isAlcohol when the restaurant serves alcohol", async () => {
    const menu = await serviceFor("restaurant", { servesAlcohol: true }).getOutletMenu("org_1", "o1");
    expect(menu.items.map((i) => [i.id, i.isAlcohol])).toEqual([
      ["fries", false],
      ["beer", true],
    ]);
    expect(menu.alcohol).toEqual({ served: true, dineInOnly: true });
  });

  it("never shows drinks for a cloud kitchen", async () => {
    const menu = await serviceFor("cloud_kitchen", { servesAlcohol: true }).getOutletMenu(
      "org_1",
      "o1",
    );
    expect(menu.items.map((i) => i.id)).toEqual(["fries"]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { MenuService } from "./menu.service";

function item(id: string, extras: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    description: null,
    productType: null,
    basePrice: 40,
    packagingCharge: 0,
    categoryId: "c1",
    imageUrl: "/demo-menu/samosa.webp",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    isVeg: true,
    isSpecial: false,
    isTaxExempt: false,
    taxGroupId: null,
    allergens: [],
    stockBasedAvailability: false,
    variants: [],
    modifierGroups: [],
    outletPrices: [],
    recipe: null,
    ...extras,
  };
}

function serviceFor(items: ReturnType<typeof item>[]) {
  const prisma = {
    outlet: {
      findFirst: vi.fn(async () => ({ id: "o1", operatingMode: "counter" })),
    },
    organization: {
      findUnique: vi.fn(async () => ({
        businessType: "restaurant",
        settings: { settings: {} },
      })),
    },
    menuSchedule: { findMany: vi.fn(async () => []) },
    taxGroup: { findMany: vi.fn(async () => []) },
    menuCategory: {
      findMany: vi.fn(async () => [{ id: "c1", name: "Snacks", description: null, imageUrl: null }]),
    },
    menuItem: { findMany: vi.fn(async () => items) },
    happyHourRule: { findMany: vi.fn(async () => []) },
    recipe: { findUnique: vi.fn(async () => null) },
  };
  return new MenuService(prisma as never, {} as never);
}

describe("MenuService.getOutletMenu availability", () => {
  const soldOut = item("samosa", { outletPrices: [{ isAvailable: false, price: 40 }] });
  const inStock = item("chai");

  it("hides sold-out items from the public menu", async () => {
    const menu = await serviceFor([inStock, soldOut]).getOutletMenu("org_1", "o1");
    expect(menu.items.map((i) => i.id)).toEqual(["chai"]);
  });

  it("returns sold-out items for the POS when asked, and versions the photo URL", async () => {
    const menu = await serviceFor([inStock, soldOut]).getOutletMenu("org_1", "o1", {
      includeUnavailable: true,
    });
    const samosa = menu.items.find((i) => i.id === "samosa");
    expect(samosa?.isAvailable).toBe(false);
    expect(menu.items.find((i) => i.id === "chai")?.isAvailable).toBe(true);
    expect(samosa?.imageUrl).toContain("/demo-menu/samosa.webp");
    expect(samosa?.imageUrl).toContain("v=");
  });
});

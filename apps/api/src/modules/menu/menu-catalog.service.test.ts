import { describe, expect, it, vi } from "vitest";
import { MenuCatalogService } from "./menu-catalog.service";

type Row = Record<string, unknown> & { id: string };

interface FakeOptions {
  businessType?: string;
  settings?: Record<string, unknown>;
  taxGroups?: Array<{ id: string; rates: Array<{ type: string }> }>;
  barStations?: number;
}

/** Minimal in-memory Prisma double; every read asserts the org scope it was given. */
function fakePrisma(orgId: string, options: FakeOptions = {}) {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;
  const menuItems: Row[] = [];
  const categories: Row[] = [];
  const inventory: Row[] = [];
  const recipes: Row[] = [];

  const assertOrg = (where: { organizationId?: unknown } | undefined) => {
    expect(where?.organizationId).toBe(orgId);
  };

  const prisma = {
    organization: {
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        args.where.id === orgId
          ? { businessType: options.businessType ?? "restaurant", settings: options.settings ?? {} }
          : null,
      ),
    },
    menuItem: {
      findMany: vi.fn(
        async (args: {
          where: { organizationId: string; catalogItemId?: { in?: string[]; not?: null } };
          select: Record<string, boolean>;
        }) => {
          assertOrg(args.where);
          const filter = args.where.catalogItemId;
          return menuItems.filter((m) => {
            if (m.organizationId !== args.where.organizationId) return false;
            if (filter?.in) return filter.in.includes(m.catalogItemId as string);
            if (filter && "not" in filter) return m.catalogItemId != null;
            return true;
          });
        },
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: nextId("item"), ...args.data } as Row;
        menuItems.push(row);
        return { id: row.id, name: row.name };
      }),
    },
    menuCategory: {
      findUnique: vi.fn(
        async (args: { where: { organizationId_slug: { organizationId: string; slug: string } } }) => {
          const key = args.where.organizationId_slug;
          expect(key.organizationId).toBe(orgId);
          return (
            categories.find((c) => c.organizationId === key.organizationId && c.slug === key.slug) ??
            null
          );
        },
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: nextId("cat"), isActive: true, ...args.data } as Row;
        categories.push(row);
        return { id: row.id };
      }),
      update: vi.fn(async () => ({})),
    },
    inventoryItem: {
      findFirst: vi.fn(
        async (args: { where: { organizationId: string; outletId: null; catalogKey: string } }) => {
          assertOrg(args.where);
          return (
            inventory.find(
              (i) =>
                i.organizationId === args.where.organizationId &&
                i.outletId === null &&
                i.catalogKey === args.where.catalogKey,
            ) ?? null
          );
        },
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: nextId("inv"), ...args.data } as Row;
        inventory.push(row);
        return { id: row.id };
      }),
    },
    recipe: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: nextId("recipe"), ...args.data } as Row;
        recipes.push(row);
        return row;
      }),
    },
    taxGroup: {
      findMany: vi.fn(async (args: { where: { organizationId: string } }) => {
        assertOrg(args.where);
        return options.taxGroups ?? [];
      }),
    },
    kitchenStation: {
      count: vi.fn(async (args: { where: { outlet: { organizationId: string } } }) => {
        expect(args.where.outlet.organizationId).toBe(orgId);
        return options.barStations ?? 0;
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma, menuItems, categories, inventory, recipes };
}

describe("MenuCatalogService.getCatalog", () => {
  it("filters by the org's stored business type, not the caller", async () => {
    const { prisma } = fakePrisma("org_cafe", { businessType: "cafe" });
    const service = new MenuCatalogService(prisma as never);
    const result = await service.getCatalog("org_cafe");
    const ids = result.sections.map((s) => s.id);
    expect(result.businessType).toBe("cafe");
    expect(ids).not.toContain("indian_main_course");
    expect(ids).not.toContain("whisky");
    expect(ids).toContain("hot_beverages");
  });

  it("returns paise prices, placeholder images and imported flags", async () => {
    const { prisma, menuItems } = fakePrisma("org_1");
    menuItems.push({ id: "m1", organizationId: "org_1", catalogItemId: "burgers.aloo_tikki_burger" });
    menuItems.push({ id: "m2", organizationId: "org_other", catalogItemId: "burgers.classic_veg_burger" });
    const service = new MenuCatalogService(prisma as never);
    const result = await service.getCatalog("org_1");
    const burgers = result.sections.find((s) => s.id === "burgers")!;
    const items = burgers.subCategories.flatMap((s) => s.items);
    const aloo = items.find((i) => i.id === "burgers.aloo_tikki_burger")!;
    const classic = items.find((i) => i.id === "burgers.classic_veg_burger")!;
    expect(aloo.imported).toBe(true);
    expect(classic.imported).toBe(false);
    expect(aloo.defaultPrice % 100).toBe(0);
    expect(aloo.defaultPrice).toBeGreaterThanOrEqual(aloo.priceRange.min);
    expect(aloo.imageUrl).toContain("/catalog-placeholders/burgers.webp");
    expect(aloo.stock.map((s) => s.key)).toEqual(["burger_bun", "veg_patty"]);
  });
});

describe("MenuCatalogService.importItems", () => {
  it("rejects items the org's business type cannot sell", async () => {
    const { prisma } = fakePrisma("org_ck", { businessType: "cloud_kitchen" });
    const service = new MenuCatalogService(prisma as never);
    await expect(
      service.importItems("org_ck", { items: [{ catalogItemId: "whisky.royal_stag" }] }),
    ).rejects.toThrow(/not available/);
    await expect(
      service.importItems("org_ck", { items: [{ catalogItemId: "nope.item" }] }),
    ).rejects.toThrow(/Unknown catalog item/);
    await expect(service.importItems("org_ck", { items: [] })).rejects.toThrow(/at least one/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates org-scoped category, item, variants, inventory and key-component recipe", async () => {
    const { prisma, menuItems, categories, inventory, recipes } = fakePrisma("org_1", {
      settings: { defaultTaxGroupId: "tg_gst" },
      taxGroups: [{ id: "tg_gst", rates: [{ type: "CGST" }, { type: "SGST" }] }],
    });
    const service = new MenuCatalogService(prisma as never);
    const result = await service.importItems("org_1", {
      items: [
        { catalogItemId: "burgers.aloo_tikki_burger", name: "House Aloo Burger", price: 12900 },
        { catalogItemId: "burgers.classic_veg_burger" },
        { catalogItemId: "indian_main_course.paneer_butter_masala", trackStock: true },
      ],
    });

    expect(result.created).toHaveLength(3);
    expect(result.recipesCreated).toBe(3);
    // Shared bun/patty rows are reused across burgers; paneer adds one more.
    expect(result.inventoryCreated).toBe(3);
    expect(inventory.map((i) => i.catalogKey).sort()).toEqual(["burger_bun", "paneer", "veg_patty"]);
    expect(inventory.every((i) => i.organizationId === "org_1" && i.outletId === null)).toBe(true);
    const bun = inventory.find((i) => i.catalogKey === "burger_bun")!;
    expect(bun.unit).toBe("pieces");
    expect(bun.packLabel).toBeTruthy();

    const aloo = menuItems.find((m) => m.catalogItemId === "burgers.aloo_tikki_burger")!;
    expect(aloo.organizationId).toBe("org_1");
    expect(aloo.name).toBe("House Aloo Burger");
    expect(aloo.basePrice).toBe(129);
    expect(aloo.imageUrl).toBe("/catalog-placeholders/burgers.webp");
    expect(aloo.taxGroupId).toBe("tg_gst");

    const paneer = menuItems.find((m) => m.catalogItemId === "indian_main_course.paneer_butter_masala")!;
    const variants = (paneer.variants as { create: Array<{ name: string; stockMultiplier: number }> }).create;
    expect(variants.map((v) => [v.name, v.stockMultiplier])).toEqual([
      ["Half", 0.5],
      ["Full", 1],
    ]);

    expect(categories.every((c) => c.organizationId === "org_1")).toBe(true);
    expect(categories.map((c) => c.name)).toContain("Burgers · Veg Burgers");
    const burgerRecipe = recipes.find((r) => r.menuItemId === aloo.id)!;
    const ingredients = (burgerRecipe.ingredients as { create: Array<{ quantity: number }> }).create;
    expect(ingredients.map((i) => i.quantity)).toEqual([1, 1]);
  });

  it("is idempotent: re-importing skips items already on the menu", async () => {
    const { prisma, menuItems, inventory } = fakePrisma("org_1");
    const service = new MenuCatalogService(prisma as never);
    await service.importItems("org_1", { items: [{ catalogItemId: "burgers.aloo_tikki_burger" }] });
    const again = await service.importItems("org_1", {
      items: [
        { catalogItemId: "burgers.aloo_tikki_burger" },
        { catalogItemId: "burgers.aloo_tikki_burger" },
        { catalogItemId: "burgers.classic_veg_burger" },
      ],
    });
    expect(again.skipped).toEqual([
      { catalogItemId: "burgers.aloo_tikki_burger", reason: "already_imported" },
    ]);
    expect(again.created.map((c) => c.catalogItemId)).toEqual(["burgers.classic_veg_burger"]);
    expect(again.inventoryCreated).toBe(0);
    expect(menuItems).toHaveLength(2);
    expect(inventory).toHaveLength(2);
    expect(new Set(menuItems.map((m) => m.slug)).size).toBe(2);
  });

  it("skips stock linking when trackStock is false", async () => {
    const { prisma, inventory, recipes } = fakePrisma("org_1");
    const service = new MenuCatalogService(prisma as never);
    const result = await service.importItems("org_1", {
      items: [{ catalogItemId: "burgers.aloo_tikki_burger", trackStock: false }],
    });
    expect(result.created).toHaveLength(1);
    expect(inventory).toHaveLength(0);
    expect(recipes).toHaveLength(0);
  });

  it("bar: liquor uses the excise group and BAR station, with per-brand bottle stock", async () => {
    const { prisma, menuItems, categories, inventory } = fakePrisma("org_bar", {
      businessType: "bar",
      settings: { defaultTaxGroupId: "tg_gst" },
      taxGroups: [
        { id: "tg_gst", rates: [{ type: "CGST" }, { type: "SGST" }] },
        { id: "tg_excise", rates: [{ type: "EXCISE" }] },
      ],
      barStations: 1,
    });
    const service = new MenuCatalogService(prisma as never);
    const result = await service.importItems("org_bar", {
      items: [{ catalogItemId: "whisky.royal_stag" }, { catalogItemId: "burgers.aloo_tikki_burger" }],
    });
    expect(result.warnings).toEqual([]);
    const whisky = menuItems.find((m) => m.catalogItemId === "whisky.royal_stag")!;
    const burger = menuItems.find((m) => m.catalogItemId === "burgers.aloo_tikki_burger")!;
    expect(whisky.taxGroupId).toBe("tg_excise");
    expect(burger.taxGroupId).toBe("tg_gst");
    const whiskyCategory = categories.find((c) => c.id === whisky.categoryId)!;
    expect(whiskyCategory.kitchenStationCode).toBe("BAR");
    const bottle = inventory.find((i) => i.catalogKey === "item:whisky.royal_stag")!;
    expect(bottle.unit).toBe("mL");
    const variants = (whisky.variants as { create: Array<{ name: string; stockMultiplier: number }> }).create;
    expect(variants.map((v) => v.stockMultiplier)).toEqual([1, 2, 25]);
  });

  it("warns instead of inventing tax when no excise group exists", async () => {
    const { prisma, menuItems } = fakePrisma("org_bar", { businessType: "bar" });
    const service = new MenuCatalogService(prisma as never);
    const result = await service.importItems("org_bar", {
      items: [{ catalogItemId: "whisky.royal_stag" }],
    });
    expect(result.warnings[0]).toMatch(/excise/i);
    expect(menuItems[0].taxGroupId).toBeNull();
  });

  it("validates owner-edited variants", async () => {
    const { prisma } = fakePrisma("org_1");
    const service = new MenuCatalogService(prisma as never);
    await expect(
      service.importItems("org_1", {
        items: [
          {
            catalogItemId: "indian_main_course.paneer_butter_masala",
            variants: [{ name: "Half", price: 15000, stockMultiplier: 0 }],
          },
        ],
      }),
    ).rejects.toThrow(/stock multiplier/);
  });
});

import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  deductRecipeIngredients,
  lineStockQuantity,
  netOrderStockToRestore,
  packsToBaseUnits,
  splitStockMetadata,
} from "./recipe-stock.util";
import { RecipesService } from "../modules/recipes/recipes.service";

describe("lineStockQuantity (variant multiplier)", () => {
  it("defaults to 1× without a variant", () => {
    expect(lineStockQuantity(3)).toBe(3);
    expect(lineStockQuantity(3, null)).toBe(3);
  });

  it("scales by the variant multiplier (Half plate, 60 mL peg)", () => {
    expect(lineStockQuantity(2, 0.5)).toBe(1);
    expect(lineStockQuantity(1, new Prisma.Decimal(2))).toBe(2);
    expect(lineStockQuantity(1, "25")).toBe(25);
  });

  it("falls back to 1× for invalid multipliers and 0 for invalid quantities", () => {
    expect(lineStockQuantity(2, 0)).toBe(2);
    expect(lineStockQuantity(2, -1)).toBe(2);
    expect(lineStockQuantity(0, 2)).toBe(0);
    expect(lineStockQuantity(Number.NaN, 2)).toBe(0);
  });
});

describe("packsToBaseUnits", () => {
  it("converts packs into base units", () => {
    expect(packsToBaseUnits(2, 50)).toBe(100);
    expect(packsToBaseUnits(1.5, new Prisma.Decimal(2500))).toBe(3750);
  });

  it("rejects items without a pack size", () => {
    expect(() => packsToBaseUnits(1, null)).toThrow(/Pack size/);
    expect(() => packsToBaseUnits(1, 0)).toThrow(/Pack size/);
  });
});

function fakeDb() {
  const decrements: Array<{ id: string; qty: number }> = [];
  const db = {
    inventoryItem: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: { where: { id: string }; data: { currentStock?: unknown } }) => {
        const cs = args.data.currentStock as { decrement?: number } | undefined;
        if (cs?.decrement != null) decrements.push({ id: args.where.id, qty: cs.decrement });
        return {};
      }),
    },
    inventoryLot: {
      findMany: vi.fn(async () => []),
      update: vi.fn(),
    },
    stockMovement: { create: vi.fn(async () => ({})) },
  };
  return { db, decrements };
}

describe("key-component deduction", () => {
  it("fries: bucket weight in g minus grams per serve", async () => {
    const { db, decrements } = fakeDb();
    await deductRecipeIngredients(db as never, {
      ingredients: [{ inventoryItemId: "fries_bucket", quantity: 150 }],
      recipeYield: 1,
      quantity: lineStockQuantity(2, 1.5),
      reference: "order:1",
    });
    expect(decrements).toEqual([{ id: "fries_bucket", qty: 450 }]);
  });

  it("momos: pieces per serve deducted from pieces stock", async () => {
    const { db, decrements } = fakeDb();
    await deductRecipeIngredients(db as never, {
      ingredients: [{ inventoryItemId: "veg_momo", quantity: 6 }],
      recipeYield: 1,
      quantity: lineStockQuantity(3),
      reference: "order:2",
    });
    expect(decrements).toEqual([{ id: "veg_momo", qty: 18 }]);
  });
});

type FakeOrder = {
  id: string;
  outletId: string;
  metadata: Record<string, unknown>;
  items: Array<{ id: string; menuItemId: string | null; variantId: string | null; quantity: number }>;
};

type FakeInventoryItem = {
  id: string;
  outletId: string | null;
  name: string;
  sku: string | null;
  unit: string;
  catalogKey: string | null;
};

function fakeRecipePrisma(
  order: FakeOrder,
  opts: { inventoryItems?: FakeInventoryItem[] } = {},
) {
  const { db, decrements } = fakeDb();
  const increments: Array<{ id: string; qty: number }> = [];
  const movements: Array<{
    inventoryItemId: string;
    lotId: string | null;
    type: string;
    quantity: number;
    reference: string;
  }> = [];
  const inventoryItems = opts.inventoryItems ?? [];

  const prisma = {
    ...db,
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    inventoryItem: {
      ...db.inventoryItem,
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const w = args.where;
        if (typeof w.id === "string") return inventoryItems.find((i) => i.id === w.id) ?? null;
        const or = (w.OR as Array<Record<string, unknown>>) ?? [];
        return (
          inventoryItems.find(
            (i) =>
              i.outletId === w.outletId &&
              i.unit === w.unit &&
              or.some((c) =>
                "catalogKey" in c
                  ? i.catalogKey === c.catalogKey
                  : i.name === c.name && i.sku === c.sku,
              ),
          ) ?? null
        );
      }),
      update: vi.fn(async (args: { where: { id: string }; data: { currentStock?: unknown } }) => {
        const cs = args.data.currentStock as { decrement?: number; increment?: number } | undefined;
        if (cs?.decrement != null) decrements.push({ id: args.where.id, qty: cs.decrement });
        if (cs?.increment != null) increments.push({ id: args.where.id, qty: cs.increment });
        return {};
      }),
    },
    inventoryLot: { ...db.inventoryLot, updateMany: vi.fn(async () => ({ count: 1 })) },
    stockMovement: {
      create: vi.fn(async (args: { data: (typeof movements)[number] }) => {
        movements.push({ lotId: null, ...args.data });
        return {};
      }),
      findMany: vi.fn(async (args: { where: { reference: { in: string[] } } }) =>
        movements.filter((m) => args.where.reference.in.includes(m.reference)),
      ),
    },
    recipe: {
      findMany: vi.fn(async (args: { where: { menuItemId: { in: string[] } } }) =>
        [
          {
            id: "r1",
            menuItemId: "m_whisky",
            yield: new Prisma.Decimal(1),
            ingredients: [
              { inventoryItemId: "inv_whisky", subRecipeId: null, quantity: new Prisma.Decimal(30) },
            ],
          },
        ].filter((r) => args.where.menuItemId.in.includes(r.menuItemId)),
      ),
      findFirst: vi.fn(),
    },
    menuItemVariant: {
      findMany: vi.fn(async (args: { where: { menuItem: { organizationId: string } } }) => {
        expect(args.where.menuItem.organizationId).toBe("org_1");
        return [{ id: "v_60", stockMultiplier: new Prisma.Decimal(2) }];
      }),
    },
    order: {
      findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) =>
        args.where.id === order.id && args.where.organizationId === "org_1" ? order : null,
      ),
      update: vi.fn(async (args: { data: { metadata?: Record<string, unknown> } }) => {
        if (args.data.metadata) order.metadata = args.data.metadata;
        return {};
      }),
    },
  };
  return { prisma, decrements, increments, movements };
}

function whiskyOrder(): FakeOrder {
  return {
    id: "o1",
    outletId: "out_1",
    metadata: {},
    items: [
      { id: "li_1", menuItemId: "m_whisky", variantId: "v_60", quantity: 2 },
      { id: "li_2", menuItemId: "m_whisky", variantId: null, quantity: 1 },
    ],
  };
}

describe("RecipesService.deductForOrder", () => {
  it("multiplies recipe servings by the ordered variant's stockMultiplier", async () => {
    const order = whiskyOrder();
    const { prisma, decrements } = fakeRecipePrisma(order);
    const service = new RecipesService(prisma as never);

    expect(await service.deductForOrder("org_1", "o1")).toBe(true);
    expect(decrements).toEqual([
      { id: "inv_whisky", qty: 120 },
      { id: "inv_whisky", qty: 30 },
    ]);
    expect(order.metadata.stockDeductedItemIds).toEqual(["li_1", "li_2"]);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("does not deduct twice for the same order", async () => {
    const order = whiskyOrder();
    const { prisma, decrements } = fakeRecipePrisma(order);
    const service = new RecipesService(prisma as never);

    await service.deductForOrder("org_1", "o1");
    expect(await service.deductForOrder("org_1", "o1")).toBe(false);
    expect(decrements).toHaveLength(2);
  });

  it("ignores orders from another organization", async () => {
    const order = whiskyOrder();
    const { prisma, decrements } = fakeRecipePrisma(order);
    const service = new RecipesService(prisma as never);

    expect(await service.deductForOrder("org_2", "o1")).toBe(false);
    expect(decrements).toEqual([]);
  });

  it("deducts from the selling outlet's copy of the inventory item", async () => {
    const order = whiskyOrder();
    const { prisma, decrements } = fakeRecipePrisma(order, {
      inventoryItems: [
        { id: "inv_whisky", outletId: null, name: "Whisky", sku: "WH1", unit: "ml", catalogKey: null },
        { id: "inv_whisky_out1", outletId: "out_1", name: "Whisky", sku: "WH1", unit: "ml", catalogKey: null },
      ],
    });
    const service = new RecipesService(prisma as never);

    await service.deductForOrder("org_1", "o1");
    expect(decrements.map((d) => d.id)).toEqual(["inv_whisky_out1", "inv_whisky_out1"]);
  });

  it("falls back to the linked item when the outlet has no copy", async () => {
    const order = whiskyOrder();
    const { prisma, decrements } = fakeRecipePrisma(order, {
      inventoryItems: [
        { id: "inv_whisky", outletId: "out_2", name: "Whisky", sku: "WH1", unit: "ml", catalogKey: null },
      ],
    });
    const service = new RecipesService(prisma as never);

    await service.deductForOrder("org_1", "o1");
    expect(decrements.map((d) => d.id)).toEqual(["inv_whisky", "inv_whisky"]);
  });
});

describe("RecipesService.deductNewOrderItems", () => {
  it("does nothing before the order's stock was deducted", async () => {
    const order = whiskyOrder();
    const { prisma, decrements } = fakeRecipePrisma(order);
    const service = new RecipesService(prisma as never);

    expect(await service.deductNewOrderItems("org_1", "o1")).toBe(false);
    expect(decrements).toEqual([]);
  });

  it("deducts only lines added after serving", async () => {
    const order = whiskyOrder();
    const { prisma, decrements } = fakeRecipePrisma(order);
    const service = new RecipesService(prisma as never);

    await service.deductForOrder("org_1", "o1");
    order.items.push({ id: "li_3", menuItemId: "m_whisky", variantId: null, quantity: 3 });

    expect(await service.deductNewOrderItems("org_1", "o1")).toBe(true);
    expect(decrements.slice(2)).toEqual([{ id: "inv_whisky", qty: 90 }]);
    expect(order.metadata.stockDeductedItemIds).toEqual(["li_1", "li_2", "li_3"]);
    expect(await service.deductNewOrderItems("org_1", "o1")).toBe(false);
  });
});

describe("RecipesService.restoreForOrder", () => {
  it("returns deducted stock once and allows a later re-deduction", async () => {
    const order = whiskyOrder();
    const { prisma, increments, movements } = fakeRecipePrisma(order);
    const service = new RecipesService(prisma as never);

    await service.deductForOrder("org_1", "o1");
    expect(await service.restoreForOrder("org_1", "o1")).toBe(true);
    expect(increments).toEqual([{ id: "inv_whisky", qty: 150 }]);
    expect(movements.filter((m) => m.type === "return")).toHaveLength(1);
    expect(order.metadata.stockDeductedAt).toBeUndefined();
    expect(order.metadata.stockRestoredAt).toBeTruthy();

    expect(await service.restoreForOrder("org_1", "o1")).toBe(false);

    await service.deductForOrder("org_1", "o1");
    await service.restoreForOrder("org_1", "o1");
    expect(increments).toEqual([
      { id: "inv_whisky", qty: 150 },
      { id: "inv_whisky", qty: 150 },
    ]);
  });

  it("is a no-op when nothing was deducted", async () => {
    const order = whiskyOrder();
    const { prisma, increments } = fakeRecipePrisma(order);
    const service = new RecipesService(prisma as never);

    expect(await service.restoreForOrder("org_1", "o1")).toBe(false);
    expect(increments).toEqual([]);
  });
});

describe("netOrderStockToRestore", () => {
  it("nets sales against prior restocks per item and lot", () => {
    expect(
      netOrderStockToRestore([
        { inventoryItemId: "a", lotId: "l1", quantity: 2, restock: false },
        { inventoryItemId: "a", lotId: null, quantity: 1, restock: false },
        { inventoryItemId: "a", lotId: "l1", quantity: 2, restock: true },
        { inventoryItemId: "a", lotId: "l1", quantity: 0.5, restock: false },
      ]),
    ).toEqual([
      { inventoryItemId: "a", lotId: "l1", quantity: 0.5 },
      { inventoryItemId: "a", lotId: null, quantity: 1 },
    ]);
  });
});

describe("splitStockMetadata", () => {
  it("returns null when the parent has not been deducted", () => {
    expect(splitStockMetadata({}, ["x"])).toBeNull();
    expect(splitStockMetadata(null, ["x"])).toBeNull();
  });

  it("marks moved lines that were deducted under the parent", () => {
    expect(
      splitStockMetadata(
        { stockDeductedAt: "2026-01-01T00:00:00.000Z", stockDeductedItemIds: ["a", "b"] },
        ["b", "c"],
      ),
    ).toEqual({ stockDeductedAt: "2026-01-01T00:00:00.000Z", stockDeductedItemIds: ["b"] });
  });
});

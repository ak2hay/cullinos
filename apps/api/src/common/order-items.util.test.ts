import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { assertValidQuantity, resolveOrderItems } from "./order-items.util";

function prismaWithMenu() {
  return {
    menuItem: {
      findFirst: vi.fn(async () => ({
        id: "m1",
        name: "Burger",
        basePrice: 200,
        categoryId: "c1",
        taxGroupId: null,
        productType: null,
        variants: [],
        outletPrices: [],
        modifierGroups: [
          {
            modifierGroup: {
              modifiers: [{ id: "mod_cheese", name: "Cheese", price: 30 }],
            },
          },
        ],
      })),
    },
  } as never;
}

describe("assertValidQuantity", () => {
  it("accepts whole numbers from 1 to 999", () => {
    expect(assertValidQuantity(1)).toBe(1);
    expect(assertValidQuantity(999)).toBe(999);
  });

  it.each([0, -4, 1.5, 1000, Number.NaN, "2", undefined])("rejects %s", (q) => {
    expect(() => assertValidQuantity(q)).toThrow(BadRequestException);
  });
});

describe("resolveOrderItems", () => {
  it("rejects a negative quantity that would lower the bill", async () => {
    await expect(
      resolveOrderItems(prismaWithMenu(), "org_1", "o1", [
        { menuItemId: "m1", quantity: 5 },
        { menuItemId: "m1", quantity: -4 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects open items with client prices on public/guest orders", async () => {
    await expect(
      resolveOrderItems(
        prismaWithMenu(),
        "org_1",
        "o1",
        [{ name: "Anything", unitPrice: 0, quantity: 1 }],
        { publicOrder: true },
      ),
    ).rejects.toThrow(/menuItemId/);
  });

  it("rejects a negative open-item price even for staff", async () => {
    await expect(
      resolveOrderItems(prismaWithMenu(), "org_1", "o1", [
        { name: "Refund hack", unitPrice: -500, quantity: 1 },
      ]),
    ).rejects.toThrow(/non-negative/);
  });

  it("prices guest modifiers from the catalogue, accepting `id` as the modifier id", async () => {
    const [line] = await resolveOrderItems(
      prismaWithMenu(),
      "org_1",
      "o1",
      [{ menuItemId: "m1", quantity: 2, modifiers: [{ id: "mod_cheese", name: "Cheese", price: -999 }] }],
      { publicOrder: true },
    );
    expect(line.unitPrice).toBe(230);
    expect(line.quantity).toBe(2);
    expect(line.modifiers).toEqual([{ name: "Cheese", price: 3000, modifierId: "mod_cheese" }]);
  });

  it("rejects free-form modifiers on public/guest orders", async () => {
    await expect(
      resolveOrderItems(
        prismaWithMenu(),
        "org_1",
        "o1",
        [{ menuItemId: "m1", quantity: 1, modifiers: [{ name: "Discount", price: -100 }] }],
        { publicOrder: true },
      ),
    ).rejects.toThrow(/modifierId/);
  });
});

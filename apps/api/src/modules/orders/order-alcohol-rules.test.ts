import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

/** Thrown by computeTax, which runs only after every alcohol rule has passed. */
const PAST_ALCOHOL_CHECKS = "past-alcohol-checks";

const MENU = {
  beer: { productType: "alcohol", name: "Kingfisher" },
  fries: { productType: null, name: "French Fries" },
} as const;

function serviceFor(businessType: string, settings: Record<string, unknown> = {}) {
  const prisma = {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return {
          id: args.where.id,
          outletId: "o1",
          status: "confirmed",
          type: "qr",
          metadata: {},
          items: [],
          organization: { businessType, settings: { settings } },
        };
      }),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => {
        throw new Error(PAST_ALCOHOL_CHECKS);
      }),
    },
    outlet: {
      findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return { id: args.where.id, organization: { businessType, settings: { settings } } };
      }),
    },
    table: {
      findFirst: vi.fn(async (args: { where: { id: string } }) =>
        args.where.id === "t1" ? { id: "t1" } : null,
      ),
    },
    organization: { findUnique: vi.fn(async () => ({ timezone: "Asia/Kolkata" })) },
    happyHourRule: { findMany: vi.fn(async () => []) },
    orderItem: {
      createMany: vi.fn(async () => {
        throw new Error(PAST_ALCOHOL_CHECKS);
      }),
    },
    menuItem: {
      findFirst: vi.fn(async (args: { where: { id: keyof typeof MENU; organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        const row = MENU[args.where.id];
        return row
          ? {
              id: args.where.id,
              name: row.name,
              productType: row.productType,
              basePrice: 200,
              categoryId: "c1",
              taxGroupId: null,
              variants: [],
              outletPrices: [],
              modifierGroups: [],
            }
          : null;
      }),
    },
  };
  const service = new OrdersService(prisma as never, {} as never);
  vi.spyOn(service as never as { computeTax: () => Promise<never> }, "computeTax").mockRejectedValue(
    new Error(PAST_ALCOHOL_CHECKS),
  );
  return Object.assign(service, { prisma });
}

async function outcome(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected create() to reject");
}

const beer = [{ menuItemId: "beer", quantity: 1 }];

describe("OrdersService.create alcohol rules", () => {
  const restaurantWithBar = () => serviceFor("restaurant", { servesAlcohol: true });

  it("rejects a public takeaway order with drinks", async () => {
    const err = await outcome(
      restaurantWithBar().create("org_1", null, {
        outletId: "o1",
        type: "takeaway",
        items: beer,
        publicOrder: true,
        ageConfirmed: true,
      } as never),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toBe("Drinks can only be ordered for dine-in");
  });

  it("rejects a public dine-in drink order without age confirmation", async () => {
    const err = await outcome(
      restaurantWithBar().create("org_1", null, {
        outletId: "o1",
        type: "dine_in",
        items: beer,
        publicOrder: true,
      } as never),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toMatch(/legal drinking age/i);
  });

  it("accepts a public dine-in drink order with age confirmation", async () => {
    const err = await outcome(
      restaurantWithBar().create("org_1", null, {
        outletId: "o1",
        type: "dine_in",
        items: beer,
        publicOrder: true,
        ageConfirmed: true,
      } as never),
    );
    expect(err.message).toBe(PAST_ALCOHOL_CHECKS);
  });

  it("lets staff POS sell drinks for takeaway without an age flag", async () => {
    const err = await outcome(
      restaurantWithBar().create("org_1", "user_1", {
        outletId: "o1",
        type: "takeaway",
        items: beer,
      } as never),
    );
    expect(err.message).toBe(PAST_ALCOHOL_CHECKS);
  });

  it("rejects drinks, even from POS, when the restaurant has alcohol turned off", async () => {
    const err = await outcome(
      serviceFor("restaurant").create("org_1", "user_1", {
        outletId: "o1",
        type: "dine_in",
        items: beer,
      } as never),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toBe("This restaurant does not serve alcohol");
  });

  it("does not apply drink rules to food-only public takeaway orders", async () => {
    const err = await outcome(
      serviceFor("restaurant").create("org_1", null, {
        outletId: "o1",
        type: "takeaway",
        items: [{ menuItemId: "fries", quantity: 1 }],
        publicOrder: true,
      } as never),
    );
    expect(err.message).toBe(PAST_ALCOHOL_CHECKS);
  });

  it("requires age confirmation for a table QR session order", async () => {
    const session = {
      outletId: "o1",
      source: "QR",
      tableId: "t1",
      items: beer,
      customerOrder: true,
    };
    const missing = await outcome(restaurantWithBar().create("org_1", null, session as never));
    expect(missing).toBeInstanceOf(BadRequestException);
    expect(missing.message).toMatch(/legal drinking age/i);

    const confirmed = await outcome(
      restaurantWithBar().create("org_1", null, { ...session, ageConfirmed: true } as never),
    );
    expect(confirmed.message).toBe(PAST_ALCOHOL_CHECKS);
  });

  it("always allows drinks for a bar", async () => {
    const err = await outcome(
      serviceFor("bar").create("org_1", null, {
        outletId: "o1",
        type: "qr",
        tableId: "t1",
        items: beer,
        publicOrder: true,
        ageConfirmed: true,
      } as never),
    );
    expect(err.message).toBe(PAST_ALCOHOL_CHECKS);
  });
});

describe("OrdersService.addItems alcohol rules", () => {
  it("rejects drinks added from a guest session without age confirmation", async () => {
    const service = serviceFor("restaurant", { servesAlcohol: true });
    const err = await outcome(service.addItems("org_1", "ord_1", beer, { customerOrder: true }));
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toMatch(/legal drinking age/i);
    expect(service.prisma.orderItem.createMany).not.toHaveBeenCalled();
  });

  it("records the age confirmation on the order when a guest adds drinks", async () => {
    const service = serviceFor("restaurant", { servesAlcohol: true });
    const err = await outcome(
      service.addItems("org_1", "ord_1", beer, { customerOrder: true, ageConfirmed: true }),
    );
    expect(err.message).toBe(PAST_ALCOHOL_CHECKS);
    expect(service.prisma.order.update).toHaveBeenCalledWith({
      where: { id: "ord_1" },
      data: { metadata: { alcoholAgeConfirmed: true } },
    });
  });

  it("lets staff add drinks without an age flag but not when alcohol is off", async () => {
    const staff = await outcome(
      serviceFor("restaurant", { servesAlcohol: true }).addItems("org_1", "ord_1", beer),
    );
    expect(staff.message).toBe(PAST_ALCOHOL_CHECKS);

    const off = await outcome(serviceFor("restaurant").addItems("org_1", "ord_1", beer));
    expect(off.message).toBe("This restaurant does not serve alcohol");
  });
});

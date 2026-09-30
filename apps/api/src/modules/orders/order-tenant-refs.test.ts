import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

/** Thrown by computeTax, which runs only after references and items are validated. */
const PAST_VALIDATION = "past-validation";

function serviceFor(opts: {
  existingOrder?: { organizationId: string } | null;
  tableFound?: boolean;
  sessionFound?: boolean;
  customerFound?: boolean;
} = {}) {
  const prisma = {
    order: {
      findUnique: vi.fn(async () =>
        opts.existingOrder
          ? { id: "ord_x", orderNumber: "0001", status: "confirmed", tableId: null, outletId: "o9", subtotal: 0, items: [], ...opts.existingOrder }
          : null,
      ),
      count: vi.fn(async () => {
        throw new Error(PAST_VALIDATION);
      }),
    },
    outlet: {
      findFirst: vi.fn(async () => ({ id: "o1", organization: { businessType: "restaurant" } })),
    },
    table: { findFirst: vi.fn(async () => (opts.tableFound === false ? null : { id: "t1" })) },
    tableSession: {
      findFirst: vi.fn(async () => (opts.sessionFound === false ? null : { id: "s1" })),
    },
    customer: {
      findFirst: vi.fn(async () => (opts.customerFound === false ? null : { id: "c1" })),
    },
    organization: { findUnique: vi.fn(async () => ({ timezone: "Asia/Kolkata" })) },
    happyHourRule: { findMany: vi.fn(async () => []) },
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
        modifierGroups: [],
      })),
    },
  };
  const service = new OrdersService(prisma as never, {} as never);
  vi.spyOn(service as never as { computeTax: () => Promise<never> }, "computeTax").mockRejectedValue(
    new Error(PAST_VALIDATION),
  );
  return { service, prisma };
}

async function outcome(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected create() to reject");
}

const items = [{ menuItemId: "m1", quantity: 1 }];

describe("OrdersService.create tenant references", () => {
  it("never returns another tenant's order for a reused idempotency key", async () => {
    const { service } = serviceFor({ existingOrder: { organizationId: "org_other" } });
    const err = await outcome(
      service.create("org_1", null, {
        outletId: "o1",
        items,
        idempotencyKey: "aggregator:swiggy:123",
      } as never),
    );
    expect(err).toBeInstanceOf(ConflictException);
  });

  it("rejects a table from another tenant or outlet", async () => {
    const { service, prisma } = serviceFor({ tableFound: false });
    const err = await outcome(
      service.create("org_1", null, { outletId: "o1", type: "dine_in", tableId: "t_other", items } as never),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toBe("Invalid table");
    expect(prisma.table.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          section: { floor: { outletId: "o1", outlet: { organizationId: "org_1" } } },
        }),
      }),
    );
  });

  it("rejects a customer or table session from another tenant", async () => {
    const noCustomer = await outcome(
      serviceFor({ customerFound: false }).service.create("org_1", null, {
        outletId: "o1",
        customerId: "c_other",
        items,
      } as never),
    );
    expect(noCustomer.message).toBe("Invalid customer");

    const noSession = await outcome(
      serviceFor({ sessionFound: false }).service.create("org_1", null, {
        outletId: "o1",
        type: "dine_in",
        tableId: "t1",
        tableSessionId: "s_other",
        items,
      } as never),
    );
    expect(noSession.message).toBe("Invalid table session");
  });

  it("prices table QR session orders from the catalogue only", async () => {
    const { service } = serviceFor();
    const err = await outcome(
      service.create("org_1", null, {
        outletId: "o1",
        source: "QR",
        tableId: "t1",
        customerOrder: true,
        items: [{ name: "Free lobster", unitPrice: 0, quantity: 1 }],
      } as never),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toMatch(/menuItemId/);
  });

  it("passes validation for a valid same-tenant order", async () => {
    const { service } = serviceFor();
    const err = await outcome(
      service.create("org_1", null, {
        outletId: "o1",
        type: "dine_in",
        tableId: "t1",
        customerId: "c1",
        items,
      } as never),
    );
    expect(err.message).toBe(PAST_VALIDATION);
  });
});

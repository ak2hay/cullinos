import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

function serviceFor(businessType: string) {
  const prisma = {
    order: { findUnique: vi.fn(), count: vi.fn() },
    outlet: {
      findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return { id: args.where.id, organization: { businessType } };
      }),
    },
  };
  const service = new OrdersService(prisma as never, {} as never);
  return { service, prisma };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected create() to reject");
}

describe("OrdersService.create order-type enforcement", () => {
  it("rejects dine-in and table orders for a cloud kitchen before touching items", async () => {
    const { service, prisma } = serviceFor("cloud_kitchen");
    const dineIn = await rejection(
      service.create("org_1", null, { outletId: "o1", type: "dine_in", items: [] } as never),
    );
    expect(dineIn).toBeInstanceOf(BadRequestException);

    const withTable = await rejection(
      service.create("org_1", null, {
        outletId: "o1",
        type: "delivery",
        tableId: "t1",
        items: [],
      } as never),
    );
    expect(withTable).toBeInstanceOf(BadRequestException);
    expect((withTable as Error).message).toMatch(/table/i);
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it("rejects dine-in for a food truck", async () => {
    const { service } = serviceFor("food_truck");
    const err = await rejection(
      service.create("org_1", null, { outletId: "o1", type: "dine_in", items: [] } as never),
    );
    expect(err).toBeInstanceOf(BadRequestException);
  });

  it("rejects an outlet from another organization", async () => {
    const prisma = { order: { findUnique: vi.fn() }, outlet: { findFirst: vi.fn(async () => null) } };
    const service = new OrdersService(prisma as never, {} as never);
    const err = await rejection(
      service.create("org_1", null, { outletId: "other", type: "takeaway", items: [] } as never),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as Error).message).toMatch(/outlet/i);
  });
});

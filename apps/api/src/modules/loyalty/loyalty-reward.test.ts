import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { LoyaltyService } from "./loyalty.service";

function setup(opts: {
  points: number;
  order?: { status: string; customerId: string | null } | null;
}) {
  const customer = { id: "cust_1", organizationId: "org_1", loyaltyPoints: opts.points };
  const tx = {
    customer: {
      updateMany: vi.fn(
        async ({ where, data }: { where: { loyaltyPoints: { gte: number } }; data: { loyaltyPoints: { decrement: number } } }) => {
          if (customer.loyaltyPoints < where.loyaltyPoints.gte) return { count: 0 };
          customer.loyaltyPoints -= data.loyaltyPoints.decrement;
          return { count: 1 };
        },
      ),
      findUniqueOrThrow: vi.fn(async () => ({ ...customer })),
    },
    loyaltyTransaction: { create: vi.fn(async () => ({})) },
    orderItem: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    loyaltyReward: {
      findFirst: vi.fn(async () => ({
        id: "rw_1",
        name: "Free drink",
        pointsCost: 100,
        menuItemId: "mi_1",
        menuItem: { id: "mi_1", name: "Cold drink" },
      })),
    },
    customer: { findFirst: vi.fn(async () => ({ ...customer })) },
    order: {
      findFirst: vi.fn(async (args: { where: { organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return opts.order === undefined ? { status: "confirmed", customerId: null } : opts.order;
      }),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new LoyaltyService(prisma as never), tx, customer };
}

describe("LoyaltyService.redeemReward", () => {
  it("deducts points atomically and attaches the free item to an open order", async () => {
    const { service, tx, customer } = setup({ points: 150 });
    const result = await service.redeemReward("org_1", "cust_1", "rw_1", "ord_1");
    expect(result.remainingPoints).toBe(50);
    expect(customer.loyaltyPoints).toBe(50);
    expect(tx.orderItem.create).toHaveBeenCalledOnce();
  });

  it("rejects when points are insufficient at deduction time", async () => {
    const { service, tx } = setup({ points: 99 });
    await expect(service.redeemReward("org_1", "cust_1", "rw_1")).rejects.toThrow(
      "Insufficient points",
    );
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects orders outside the organization", async () => {
    const { service } = setup({ points: 500, order: null });
    await expect(service.redeemReward("org_1", "cust_1", "rw_1", "ord_x")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejects closed orders and orders owned by another customer", async () => {
    const closed = setup({ points: 500, order: { status: "completed", customerId: null } });
    await expect(closed.service.redeemReward("org_1", "cust_1", "rw_1", "ord_1")).rejects.toThrow(
      BadRequestException,
    );
    const other = setup({ points: 500, order: { status: "confirmed", customerId: "cust_2" } });
    await expect(other.service.redeemReward("org_1", "cust_1", "rw_1", "ord_1")).rejects.toThrow(
      "Order belongs to another customer",
    );
    expect(other.customer.loyaltyPoints).toBe(500);
  });
});

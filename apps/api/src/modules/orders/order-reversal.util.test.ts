import { describe, expect, it, vi } from "vitest";
import {
  canTransitionOrder,
  orderLoyaltyReferences,
  reverseOrderIncentives,
} from "./order-reversal.util";

function makeTx(opts: {
  usages?: Array<{ id: string; couponId: string }>;
  entries?: Array<{ id: string; customerId: string; points: number }>;
  balance?: number;
  alreadyReversed?: string[];
}) {
  const created: Array<{ customerId: string; points: number; reference: string }> = [];
  const increments: number[] = [];
  const tx = {
    couponUsage: {
      findMany: vi.fn().mockResolvedValue(opts.usages ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: opts.usages?.length ?? 0 }),
    },
    coupon: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    loyaltyTransaction: {
      findMany: vi.fn().mockResolvedValue(opts.entries ?? []),
      findFirst: vi.fn(async ({ where }: { where: { reference: string } }) =>
        opts.alreadyReversed?.includes(where.reference) ? { id: "x" } : null,
      ),
      create: vi.fn(async ({ data }: { data: (typeof created)[number] }) => {
        created.push(data);
        return data;
      }),
    },
    customer: {
      findUnique: vi.fn().mockResolvedValue({ loyaltyPoints: opts.balance ?? 0 }),
      update: vi.fn(async ({ data }: { data: { loyaltyPoints: { increment: number } } }) => {
        increments.push(data.loyaltyPoints.increment);
        return {};
      }),
    },
  };
  return { tx, created, increments };
}

describe("reverseOrderIncentives", () => {
  it("releases coupon usages and decrements the coupon counter", async () => {
    const { tx } = makeTx({ usages: [{ id: "u1", couponId: "c1" }] });
    const result = await reverseOrderIncentives(tx as never, "o1");
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    expect(tx.couponUsage.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["u1"] } } });
    expect(result.couponsReleased).toBe(1);
  });

  it("claws back earned points without going below zero", async () => {
    const { tx, increments, created } = makeTx({
      entries: [{ id: "t1", customerId: "cu1", points: 50 }],
      balance: 20,
    });
    const result = await reverseOrderIncentives(tx as never, "o1");
    expect(increments).toEqual([-20]);
    expect(created[0]).toMatchObject({ points: -20, reference: "reversal:t1" });
    expect(result.loyaltyReversed).toBe(1);
  });

  it("refunds redeemed points in full", async () => {
    const { tx, increments } = makeTx({
      entries: [{ id: "t2", customerId: "cu1", points: -100 }],
      balance: 0,
    });
    await reverseOrderIncentives(tx as never, "o1");
    expect(increments).toEqual([100]);
  });

  it("is idempotent per ledger row", async () => {
    const { tx, increments } = makeTx({
      entries: [{ id: "t1", customerId: "cu1", points: 50 }],
      balance: 100,
      alreadyReversed: ["reversal:t1"],
    });
    const result = await reverseOrderIncentives(tx as never, "o1");
    expect(increments).toEqual([]);
    expect(result.loyaltyReversed).toBe(0);
  });

  it("matches every loyalty reference owned by the order", () => {
    expect(orderLoyaltyReferences("o9")).toEqual({
      exact: ["order:o9", "redeem:o9", "stamp_reward:o9"],
      rewardSuffix: ":order:o9",
    });
  });
});

describe("canTransitionOrder", () => {
  it("blocks leaving terminal statuses", () => {
    expect(canTransitionOrder("completed", "preparing")).toBe(false);
    expect(canTransitionOrder("cancelled", "confirmed")).toBe(false);
    expect(canTransitionOrder("voided", "completed")).toBe(false);
  });

  it("allows the normal kitchen flow", () => {
    expect(canTransitionOrder("draft", "confirmed")).toBe(true);
    expect(canTransitionOrder("confirmed", "preparing")).toBe(true);
    expect(canTransitionOrder("ready", "served")).toBe(true);
    expect(canTransitionOrder("served", "completed")).toBe(true);
  });

  it("does not allow cancelling a served order (void instead)", () => {
    expect(canTransitionOrder("served", "cancelled")).toBe(false);
    expect(canTransitionOrder("served", "voided")).toBe(true);
  });
});

import type { Prisma } from "@prisma/client";

/** Loyalty ledger references that belong to one order (see LoyaltyService). */
export function orderLoyaltyReferences(orderId: string) {
  return {
    exact: [`order:${orderId}`, `redeem:${orderId}`, `stamp_reward:${orderId}`],
    rewardSuffix: `:order:${orderId}`,
  };
}

/**
 * Undo coupon usage and loyalty earn/redeem entries for an order that is being cancelled or voided.
 * Idempotent: each ledger row is reversed at most once (reference `reversal:<txId>`).
 */
export async function reverseOrderIncentives(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<{ couponsReleased: number; loyaltyReversed: number }> {
  const usages = await tx.couponUsage.findMany({
    where: { orderId },
    select: { id: true, couponId: true },
  });
  for (const usage of usages) {
    await tx.coupon.updateMany({
      where: { id: usage.couponId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
  if (usages.length) {
    await tx.couponUsage.deleteMany({ where: { id: { in: usages.map((u) => u.id) } } });
  }

  const refs = orderLoyaltyReferences(orderId);
  const entries = await tx.loyaltyTransaction.findMany({
    where: {
      OR: [
        { reference: { in: refs.exact } },
        { reference: { startsWith: "reward:", endsWith: refs.rewardSuffix } },
      ],
    },
    select: { id: true, customerId: true, points: true },
  });
  let loyaltyReversed = 0;
  for (const entry of entries) {
    if (entry.points === 0) continue;
    const reversalRef = `reversal:${entry.id}`;
    const already = await tx.loyaltyTransaction.findFirst({
      where: { reference: reversalRef },
      select: { id: true },
    });
    if (already) continue;

    const customer = await tx.customer.findUnique({
      where: { id: entry.customerId },
      select: { loyaltyPoints: true },
    });
    if (!customer) continue;
    // Earned points may already be spent; never push a balance below zero.
    const delta =
      entry.points > 0 ? -Math.min(entry.points, customer.loyaltyPoints) : -entry.points;
    await tx.customer.update({
      where: { id: entry.customerId },
      data: { loyaltyPoints: { increment: delta } },
    });
    await tx.loyaltyTransaction.create({
      data: {
        customerId: entry.customerId,
        points: delta,
        type: "reversal",
        reference: reversalRef,
      },
    });
    loyaltyReversed += 1;
  }

  return { couponsReleased: usages.length, loyaltyReversed };
}

export type OrderStatusName =
  | "draft"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled"
  | "voided";

export const TERMINAL_STATUSES: readonly OrderStatusName[] = ["completed", "cancelled", "voided"];

const ACTIVE_KITCHEN: OrderStatusName[] = ["preparing", "ready", "served", "completed"];

/** Allowed order status moves. Terminal statuses have no exits. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusName, readonly OrderStatusName[]> = {
  draft: ["confirmed", "cancelled", "voided"],
  confirmed: ["draft", ...ACTIVE_KITCHEN, "cancelled", "voided"],
  preparing: ["ready", "served", "completed", "cancelled", "voided"],
  ready: ["preparing", "served", "completed", "cancelled", "voided"],
  served: ["completed", "voided"],
  completed: [],
  cancelled: [],
  voided: [],
};

export function canTransitionOrder(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = ORDER_STATUS_TRANSITIONS[from as OrderStatusName];
  return Boolean(allowed?.includes(to as OrderStatusName));
}

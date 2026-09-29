import { Prisma } from "@prisma/client";

export const ORDER_NUMBER_MAX_ATTEMPTS = 6;

/**
 * Next per-outlet order number. `count` alone collides after deletions and under
 * concurrency, so take the higher of count and the latest numeric number, then skip
 * ahead by `attempt` on retries.
 */
export function nextOrderNumberCandidate(
  count: number,
  latestOrderNumber: string | null | undefined,
  attempt: number,
): string {
  const latest = Number.parseInt(latestOrderNumber ?? "", 10);
  const base = Math.max(count, Number.isFinite(latest) ? latest : 0);
  return String(base + 1 + attempt).padStart(4, "0");
}

/** Unique violation on (outlet, orderNumber) or (outlet, pickupCode) — safe to retry. */
export function isOrderNumberCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = JSON.stringify(err.meta?.target ?? "").toLowerCase();
  if (target.includes("idempotency")) return false;
  return (
    target === '""' ||
    target.includes("order_number") ||
    target.includes("ordernumber") ||
    target.includes("pickup_code") ||
    target.includes("pickupcode")
  );
}

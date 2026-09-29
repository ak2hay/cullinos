import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isOrderNumberCollision, nextOrderNumberCandidate } from "./order-number.util";

const p2002 = (target?: unknown) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: target === undefined ? undefined : { target },
  });

describe("nextOrderNumberCandidate", () => {
  it("uses count + 1 on a clean outlet", () => {
    expect(nextOrderNumberCandidate(0, null, 0)).toBe("0001");
    expect(nextOrderNumberCandidate(41, "0041", 0)).toBe("0042");
  });

  it("does not reuse numbers after deletions shrink the count", () => {
    expect(nextOrderNumberCandidate(10, "0015", 0)).toBe("0016");
  });

  it("skips ahead on retries", () => {
    expect(nextOrderNumberCandidate(10, "0010", 2)).toBe("0013");
  });

  it("ignores non-numeric legacy numbers", () => {
    expect(nextOrderNumberCandidate(3, "ABC", 0)).toBe("0004");
  });
});

describe("isOrderNumberCollision", () => {
  it("retries on order number / pickup code unique violations", () => {
    expect(isOrderNumberCollision(p2002(["outlet_id", "order_number"]))).toBe(true);
    expect(isOrderNumberCollision(p2002(["outletId", "pickupCode"]))).toBe(true);
    expect(isOrderNumberCollision(p2002())).toBe(true);
  });

  it("does not retry idempotency-key or unrelated errors", () => {
    expect(isOrderNumberCollision(p2002(["idempotency_key"]))).toBe(false);
    expect(isOrderNumberCollision(new Error("boom"))).toBe(false);
  });
});

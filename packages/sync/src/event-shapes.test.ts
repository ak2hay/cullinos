import { describe, it, expect } from "vitest";
import { SYNC_EVENT_TYPES } from "./event-shapes";

describe("sync event shapes", () => {
  it("documents order.create and payment.cash types", () => {
    expect(SYNC_EVENT_TYPES.ORDER_CREATE).toBe("order.create");
    expect(SYNC_EVENT_TYPES.PAYMENT_CASH).toBe("payment.cash");
  });
});

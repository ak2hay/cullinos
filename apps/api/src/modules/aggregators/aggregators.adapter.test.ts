import { describe, expect, it } from "vitest";
import { SwiggyAdapter, ZomatoAdapter } from "@cullinos/integrations";

describe("aggregator adapters", () => {
  const outletId = "outlet-test-1";

  it("normalizes Swiggy webhook payload", () => {
    const adapter = new SwiggyAdapter();
    const normalized = adapter.normalizeWebhookPayload(
      {
        order: {
          order_id: "SW123",
          customer_name: "Test User",
          items: [{ name: "Biryani", quantity: 2, unit_price: 200 }],
          order_total: 400,
        },
      },
      { outletId },
    );
    expect(normalized.externalOrderId).toBe("SW123");
    expect(normalized.provider).toBe("swiggy");
    expect(normalized.items).toHaveLength(1);
    expect(normalized.idempotencyKey).toBe("aggregator:swiggy:SW123");
  });

  it("normalizes Zomato webhook payload", () => {
    const adapter = new ZomatoAdapter();
    const normalized = adapter.normalizeWebhookPayload(
      {
        tab: {
          tab_id: "ZM456",
          dishes: [{ name: "Pizza", quantity: 1, unit_price: 350 }],
          total: 350,
        },
      },
      { outletId },
    );
    expect(normalized.externalOrderId).toBe("ZM456");
    expect(normalized.provider).toBe("zomato");
    expect(normalized.items[0].name).toBe("Pizza");
  });
});

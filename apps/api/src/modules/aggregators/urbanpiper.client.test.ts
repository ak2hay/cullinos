import { describe, expect, it, vi } from "vitest";
import {
  buildUrbanPiperCataloguePayload,
  normalizeUrbanPiperOrder,
  parseUrbanPiperRiderWebhook,
  parseUrbanPiperStatusWebhook,
  shouldPushUrbanPiperStatus,
  UrbanPiperApiError,
  UrbanPiperClient,
  urbanPiperStatusFor,
} from "@cullinos/integrations";

const ORDER_FIXTURE = {
  order: {
    details: {
      id: 987654,
      order_type: "delivery",
      instructions: "Less spicy",
      order_subtotal: 480,
      total_taxes: 24,
      order_total: 504,
      created: 1760000000000,
      ext_platforms: [{ name: "swiggy", id: "SWG-1122" }],
    },
    store: { merchant_ref_id: "out_1", id: 55 },
    items: [
      {
        id: 111,
        merchant_id: "item_paneer",
        title: "Paneer Tikka",
        quantity: 2,
        price: 200,
        options_to_add: [
          { id: 9, merchant_id: "variant:v_full", title: "Full", price: 20 },
          { id: 10, merchant_id: "mod:m_cheese", title: "Extra cheese", price: 20 },
        ],
      },
      { id: 222, merchant_id: "", title: "Mystery Soda", quantity: 1, price: 40 },
    ],
  },
  customer: {
    name: "Asha",
    phone: "+919876543210",
    address: { line_1: "12 MG Road", city: "Pune", pin: "411001" },
  },
};

describe("normalizeUrbanPiperOrder", () => {
  it("maps the order relay payload", () => {
    const n = normalizeUrbanPiperOrder(ORDER_FIXTURE);
    expect(n.upOrderId).toBe("987654");
    expect(n.platform).toBe("swiggy");
    expect(n.channelOrderId).toBe("SWG-1122");
    expect(n.storeRefId).toBe("out_1");
    expect(n.orderType).toBe("delivery");
    expect(n.deliveryAddress).toBe("12 MG Road, Pune, 411001");
    expect(n.total).toBe(504);
    expect(n.items[0]).toMatchObject({
      merchantId: "item_paneer",
      quantity: 2,
      unitPrice: 240,
    });
    expect(n.items[0].options.map((o) => o.merchantId)).toEqual(["variant:v_full", "mod:m_cheese"]);
    expect(n.items[1].merchantId).toBeUndefined();
  });

  it("treats pickup orders as takeaway", () => {
    const n = normalizeUrbanPiperOrder({
      order: { details: { id: "1", order_type: "pickup" }, items: [] },
    });
    expect(n.orderType).toBe("takeaway");
  });
});

describe("status + rider webhooks", () => {
  it("parses status and rider events", () => {
    expect(parseUrbanPiperStatusWebhook({ order_id: 5, new_state: "Cancelled", message: "x" })).toEqual({
      upOrderId: "5",
      newState: "Cancelled",
      message: "x",
    });
    expect(parseUrbanPiperStatusWebhook({})).toBeNull();
    expect(
      parseUrbanPiperRiderWebhook({
        order_id: 5,
        delivery_info: { current_state: "assigned", delivery_person_details: { name: "Ravi" } },
      }),
    ).toMatchObject({ upOrderId: "5", state: "assigned", riderName: "Ravi" });
  });
});

describe("status mapping", () => {
  it("maps Cullinos statuses and only moves forward", () => {
    expect(urbanPiperStatusFor("confirmed")).toBe("Acknowledged");
    expect(urbanPiperStatusFor("ready")).toBe("Food Ready");
    expect(urbanPiperStatusFor("completed")).toBe("Dispatched");
    expect(urbanPiperStatusFor("voided")).toBe("Cancelled");
    expect(urbanPiperStatusFor("preparing")).toBeNull();

    expect(shouldPushUrbanPiperStatus("Acknowledged", undefined)).toBe(true);
    expect(shouldPushUrbanPiperStatus("Food Ready", "Acknowledged")).toBe(true);
    expect(shouldPushUrbanPiperStatus("Acknowledged", "Food Ready")).toBe(false);
    expect(shouldPushUrbanPiperStatus("Dispatched", "Dispatched")).toBe(false);
    expect(shouldPushUrbanPiperStatus("Cancelled", "Cancelled")).toBe(false);
  });
});

describe("buildUrbanPiperCataloguePayload", () => {
  it("emits items, variant and modifier option groups with mappable ref ids", () => {
    const payload = buildUrbanPiperCataloguePayload({
      categories: [
        { id: "cat_1", name: "Starters" },
        { id: "cat_unused", name: "Empty" },
      ],
      items: [
        {
          id: "item_paneer",
          name: "Paneer Tikka",
          price: 200,
          categoryId: "cat_1",
          isVeg: true,
          available: true,
          variants: [
            { id: "v_half", name: "Half", price: 200 },
            { id: "v_full", name: "Full", price: 320 },
          ],
          modifierGroups: [
            {
              id: "mg_1",
              name: "Add-ons",
              minSelect: 0,
              maxSelect: 2,
              modifiers: [{ id: "m_cheese", name: "Extra cheese", price: 20 }],
            },
          ],
        },
      ],
    });
    expect(payload.categories.map((c) => c.ref_id)).toEqual(["cat_1"]);
    expect(payload.items[0]).toMatchObject({ ref_id: "item_paneer", food_type: "1", price: 200 });
    expect(payload.options.map((o) => o.ref_id)).toEqual([
      "variant:v_half",
      "variant:v_full",
      "mod:m_cheese",
    ]);
    expect(payload.options.find((o) => o.ref_id === "variant:v_full")?.price).toBe(120);
    expect(payload.option_groups).toHaveLength(2);
  });
});

describe("UrbanPiperClient", () => {
  it("sends authenticated status updates to the sandbox host", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    const client = new UrbanPiperClient(
      { username: "biz_user", apiKey: "k123", mode: "sandbox" },
      fetchImpl,
    );
    await client.updateOrderStatus("987654", "Acknowledged", "Accepted");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://pos-int.urbanpiper.com/external/api/v1/orders/987654/status/");
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("apikey biz_user:k123");
    expect(JSON.parse(init.body)).toEqual({ new_status: "Acknowledged", message: "Accepted" });
  });

  it("builds item and store toggles", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const client = new UrbanPiperClient(
      { username: "u", apiKey: "k", mode: "production" },
      fetchImpl,
    );
    await client.setItemsAvailability("out_1", ["a", "b"], false, ["swiggy"]);
    await client.setStoreAvailability("out_1", true, ["swiggy", "zomato"]);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.urbanpiper.com/hub/api/v1/items/");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      location_ref_id: "out_1",
      platforms: ["swiggy"],
      item_ref_ids: ["a", "b"],
      action: "disable",
    });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).action).toBe("enable");
  });

  it("raises UrbanPiperApiError on failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Invalid credentials" }),
    });
    const client = new UrbanPiperClient({ username: "u", apiKey: "k", mode: "sandbox" }, fetchImpl);
    await expect(client.pushCatalogue("out_1", buildUrbanPiperCataloguePayload({ categories: [], items: [] })))
      .rejects.toBeInstanceOf(UrbanPiperApiError);
  });
});

import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UrbanPiperCredentials } from "@cullinos/integrations";
import { UrbanPiperService } from "./urbanpiper.service";
import { parseUrbanPiperConfig, redactUrbanPiperConfig } from "./urbanpiper-config.util";

const SECRET = "whsec_test_123";

function makeHarness(opts: { orderMeta?: Record<string, unknown>; orderOrg?: string } = {}) {
  const integration = {
    id: "int_1",
    organizationId: "org_1",
    provider: "urbanpiper",
    isActive: true,
    config: {
      username: "biz",
      apiKey: "key_abc",
      webhookSecret: SECRET,
      mode: "sandbox",
      acceptTimeoutMinutes: 5,
      outlets: {
        out_1: { connected: true, platforms: { swiggy: true, zomato: true }, itemSkuMap: {} },
      },
    } as Record<string, unknown>,
  };
  const order = {
    id: "ord_1",
    organizationId: opts.orderOrg ?? "org_1",
    outletId: "out_1",
    orderNumber: "A-1",
    status: "draft",
    total: 504,
    customerName: "Asha",
    notes: null,
    createdAt: new Date("2026-10-11T10:00:00Z"),
    metadata: {
      aggregator: {
        via: "urbanpiper",
        provider: "swiggy",
        externalOrderId: "987654",
        ...(opts.orderMeta ?? {}),
      },
    } as Record<string, unknown>,
    items: [],
  };

  const prisma = {
    integration: {
      findFirst: vi.fn(async ({ where }: { where: { organizationId: string } }) =>
        where.organizationId === integration.organizationId ? integration : null,
      ),
      update: vi.fn(async ({ data }: { data: { config: Record<string, unknown>; isActive: boolean } }) => {
        integration.config = data.config;
        integration.isActive = data.isActive;
        return integration;
      }),
      create: vi.fn(),
    },
    outlet: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; organizationId: string } }) =>
        where.id === "out_1" && where.organizationId === "org_1" ? { id: "out_1", name: "Main" } : null,
      ),
    },
    menuItem: {
      findMany: vi.fn(async () => [
        {
          id: "item_paneer",
          variants: [{ id: "v_full" }],
          modifierGroups: [{ modifierGroup: { modifiers: [{ id: "m_cheese" }] } }],
        },
      ]),
    },
    order: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; organizationId: string; idempotencyKey?: string } }) => {
        if (where.idempotencyKey) return null;
        return where.id === order.id && where.organizationId === order.organizationId ? order : null;
      }),
      update: vi.fn(async ({ data }: { data: { metadata?: Record<string, unknown> } }) => {
        if (data.metadata) order.metadata = data.metadata;
        return order;
      }),
    },
  };
  const orders = {
    create: vi.fn(async () => ({ id: "ord_1" })),
    confirm: vi.fn(async () => {
      order.status = "confirmed";
      return order;
    }),
    cancel: vi.fn(async () => {
      order.status = "cancelled";
      return order;
    }),
    updateStatus: vi.fn(),
  };
  const ws = { emitToOutlet: vi.fn() };
  const upClient = {
    updateOrderStatus: vi.fn(async () => ({})),
    setItemsAvailability: vi.fn(async () => ({})),
    setStoreAvailability: vi.fn(async () => ({})),
    pushCatalogue: vi.fn(async () => ({})),
  };

  class TestService extends UrbanPiperService {
    protected override createClient(_creds: UrbanPiperCredentials) {
      return upClient as never;
    }
  }
  const service = new TestService(prisma as never, orders as never, ws as never);
  return { service, prisma, orders, ws, upClient, order, integration };
}

const ORDER_PAYLOAD = {
  order: {
    details: { id: 987654, order_type: "delivery", ext_platforms: [{ name: "swiggy", id: "SWG-1" }] },
    store: { merchant_ref_id: "out_1" },
    items: [
      {
        id: 111,
        merchant_id: "item_paneer",
        title: "Paneer Tikka",
        quantity: 2,
        price: 200,
        options_to_add: [
          { merchant_id: "variant:v_full", title: "Full", price: 20 },
          { merchant_id: "mod:m_cheese", title: "Extra cheese", price: 20 },
        ],
      },
      { id: 222, title: "Mystery Soda", quantity: 1, price: 40 },
    ],
  },
  customer: { name: "Asha", phone: "+919876543210" },
};

describe("UrbanPiperService webhooks", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", "");
  });

  it("rejects a wrong webhook secret", async () => {
    const { service, orders } = makeHarness();
    await expect(service.ingestOrder("org_1", "nope", ORDER_PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(orders.create).not.toHaveBeenCalled();
  });

  it("rejects webhooks for an org without the integration", async () => {
    const { service } = makeHarness();
    await expect(service.ingestOrder("org_other", SECRET, ORDER_PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("creates a pending, prepaid order with mapped variants, modifiers and open items", async () => {
    const { service, orders, ws } = makeHarness();
    const result = await service.ingestOrder("org_1", SECRET, ORDER_PAYLOAD);
    expect(result).toMatchObject({ ok: true, orderId: "ord_1" });

    const [orgId, userId, dto, internal] = orders.create.mock.calls[0] as unknown as [
      string,
      null,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(orgId).toBe("org_1");
    expect(userId).toBeNull();
    expect(dto).toMatchObject({
      outletId: "out_1",
      source: "SWIGGY",
      autoConfirm: false,
      idempotencyKey: "urbanpiper:987654",
    });
    const items = dto.items as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ menuItemId: "item_paneer", variantId: "v_full", quantity: 2 });
    expect(items[0].modifiers).toEqual([{ name: "Extra cheese", price: 2000, modifierId: "m_cheese" }]);
    expect(items[1]).toMatchObject({ name: "Mystery Soda", unitPrice: 40 });
    expect(internal.priceOverrides).toEqual([240, undefined]);
    expect(internal.prepaid).toMatchObject({ methodCode: "aggregator_swiggy", tender: "swiggy" });
    expect(ws.emitToOutlet).toHaveBeenCalledWith("out_1", "aggregator.order.new", expect.anything());
  });
});

describe("UrbanPiperService lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", "");
  });

  it("does not act on another tenant's order", async () => {
    const { service, orders } = makeHarness({ orderOrg: "org_2" });
    await expect(service.accept("org_1", "ord_1", 15)).rejects.toBeInstanceOf(NotFoundException);
    expect(orders.confirm).not.toHaveBeenCalled();
  });

  it("accept stores prep time then confirms", async () => {
    const { service, orders, order } = makeHarness();
    await service.accept("org_1", "ord_1", 15);
    expect(orders.confirm).toHaveBeenCalledWith("org_1", "ord_1");
    expect((order.metadata.aggregator as Record<string, unknown>).prepTimeMinutes).toBe(15);
  });

  it("pushes Acknowledged once when the order is confirmed", async () => {
    const { service, upClient, order } = makeHarness({ orderMeta: { prepTimeMinutes: 25 } });
    order.status = "confirmed";
    const listener = (service as unknown as {
      onOrderStatusChanged: (c: unknown) => Promise<void>;
    }).onOrderStatusChanged.bind(service);
    const change = {
      organizationId: "org_1",
      id: "ord_1",
      outletId: "out_1",
      status: "confirmed",
      metadata: order.metadata,
    };
    await listener(change);
    await listener({ ...change, metadata: order.metadata });
    expect(upClient.updateOrderStatus).toHaveBeenCalledTimes(1);
    expect(upClient.updateOrderStatus).toHaveBeenCalledWith(
      "987654",
      "Acknowledged",
      "Accepted. Ready in 25 min",
    );
  });

  it("does not echo platform-driven cancellations back to UrbanPiper", async () => {
    const { service, upClient, order } = makeHarness({ orderMeta: { platformCancelled: true } });
    const listener = (service as unknown as {
      onOrderStatusChanged: (c: unknown) => Promise<void>;
    }).onOrderStatusChanged.bind(service);
    await listener({
      organizationId: "org_1",
      id: "ord_1",
      outletId: "out_1",
      status: "cancelled",
      metadata: order.metadata,
    });
    expect(upClient.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("records a failed status push for retry", async () => {
    const { service, upClient, order } = makeHarness();
    upClient.updateOrderStatus.mockRejectedValueOnce(new Error("UrbanPiper: timeout"));
    order.status = "ready";
    await service.retryStatusSync("org_1", "ord_1");
    const sync = (order.metadata.aggregator as Record<string, unknown>).statusSync as Record<string, unknown>;
    expect(sync).toMatchObject({ status: "Food Ready", ok: false, error: "UrbanPiper: timeout" });
  });
});

describe("urbanpiper config", () => {
  it("never exposes the API key or webhook secret in the admin view", () => {
    const parsed = parseUrbanPiperConfig({ username: "u", apiKey: "secret_key", webhookSecret: SECRET });
    const view = redactUrbanPiperConfig("org_1", true, parsed);
    const json = JSON.stringify(view);
    expect(json).not.toContain("secret_key");
    expect(json).not.toContain(SECRET);
    expect(view.apiKeyConfigured).toBe(true);
    expect(view.webhookPaths.orders).toBe("/aggregators/webhooks/urbanpiper/org_1/orders");
  });
});

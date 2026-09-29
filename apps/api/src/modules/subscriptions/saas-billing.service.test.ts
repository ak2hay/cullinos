import { describe, expect, it, vi } from "vitest";
import { SaasBillingService } from "./saas-billing.service";

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan_1",
    slug: "starter",
    name: "Starter",
    description: "Starter plan",
    priceMonthly: 2999,
    razorpayPlanIdMonthly: "plan_stale",
    ...overrides,
  };
}

function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: "org_1",
    name: "Happy house",
    email: "happy@example.com",
    phone: null,
    razorpayCustomerId: "cust_stale",
    ...overrides,
  };
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    organizationId: "org_1",
    status: "trial",
    razorpaySubId: null,
    razorpayShortUrl: null,
    plan: makePlan(),
    ...overrides,
  };
}

describe("SaasBillingService collectPayment stale ID recovery", () => {
  it("recreates missing Razorpay plan and customer then creates subscription", async () => {
    const plan = makePlan();
    const org = makeOrg();
    const subscription = makeSubscription({ plan });

    const prisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue(org),
        update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...org,
          ...data,
        })),
      },
      subscription: {
        findFirst: vi.fn().mockResolvedValue(subscription),
        update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...subscription,
          ...data,
          plan,
        })),
      },
      plan: {
        update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...plan,
          ...data,
        })),
      },
    };

    const razorpay = {
      requireConfigured: vi.fn(),
      keyId: vi.fn().mockReturnValue("rzp_test_key"),
      fetchPlan: vi.fn().mockResolvedValue(null),
      fetchCustomer: vi.fn().mockResolvedValue(null),
      fetchSubscription: vi.fn(),
      createPlan: vi.fn().mockResolvedValue({ id: "plan_new" }),
      createCustomer: vi.fn().mockResolvedValue({ id: "cust_new" }),
      createSubscription: vi.fn().mockResolvedValue({
        id: "sub_rzp_new",
        short_url: "https://rzp.io/i/checkout",
      }),
    };

    const service = new SaasBillingService(prisma as never, razorpay as never);
    const result = await service.collectPayment("org_1");

    expect(razorpay.fetchPlan).toHaveBeenCalledWith("plan_stale");
    expect(razorpay.createPlan).toHaveBeenCalled();
    expect(razorpay.fetchCustomer).toHaveBeenCalledWith("cust_stale");
    expect(razorpay.createCustomer).toHaveBeenCalled();
    expect(razorpay.createSubscription).toHaveBeenCalledWith({
      planId: "plan_new",
      customerId: "cust_new",
      notes: {
        kind: "saas",
        organizationId: "org_1",
        subscriptionId: "sub_1",
      },
    });
    expect(result).toMatchObject({
      organizationId: "org_1",
      subscriptionId: "sub_1",
      razorpaySubId: "sub_rzp_new",
      shortUrl: "https://rzp.io/i/checkout",
      status: "trial",
      keyId: "rzp_test_key",
    });
  });

  it("reuses payable gateway subscription short URL", async () => {
    const subscription = makeSubscription({
      status: "past_due",
      razorpaySubId: "sub_rzp_existing",
      razorpayShortUrl: "https://rzp.io/i/old",
    });

    const prisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue(makeOrg()),
      },
      subscription: {
        findFirst: vi.fn().mockResolvedValue(subscription),
        update: vi.fn(),
      },
      plan: { update: vi.fn() },
    };

    const razorpay = {
      requireConfigured: vi.fn(),
      keyId: vi.fn().mockReturnValue("rzp_test_key"),
      fetchSubscription: vi.fn().mockResolvedValue({
        id: "sub_rzp_existing",
        status: "created",
        short_url: "https://rzp.io/i/live",
      }),
      fetchPlan: vi.fn(),
      fetchCustomer: vi.fn(),
      createPlan: vi.fn(),
      createCustomer: vi.fn(),
      createSubscription: vi.fn(),
    };

    const service = new SaasBillingService(prisma as never, razorpay as never);
    const result = await service.collectPayment("org_1");

    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    expect(result.shortUrl).toBe("https://rzp.io/i/live");
    expect(result.razorpaySubId).toBe("sub_rzp_existing");
  });

  it("clears non-payable subscription and creates a new checkout", async () => {
    const plan = makePlan({ razorpayPlanIdMonthly: "plan_ok" });
    const org = makeOrg({ razorpayCustomerId: "cust_ok" });
    const subscription = makeSubscription({
      status: "past_due",
      razorpaySubId: "sub_rzp_dead",
      razorpayShortUrl: "https://rzp.io/i/dead",
      plan,
    });

    const prisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue(org),
        update: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn().mockResolvedValue(subscription),
        update: vi
          .fn()
          .mockResolvedValueOnce({
            ...subscription,
            razorpaySubId: null,
            razorpayShortUrl: null,
            plan,
          })
          .mockResolvedValueOnce({
            ...subscription,
            razorpaySubId: "sub_rzp_fresh",
            razorpayShortUrl: "https://rzp.io/i/fresh",
            plan,
          }),
      },
      plan: { update: vi.fn() },
    };

    const razorpay = {
      requireConfigured: vi.fn(),
      keyId: vi.fn().mockReturnValue("rzp_test_key"),
      fetchSubscription: vi.fn().mockResolvedValue(null),
      fetchPlan: vi.fn().mockResolvedValue({ id: "plan_ok" }),
      fetchCustomer: vi.fn().mockResolvedValue({ id: "cust_ok" }),
      createPlan: vi.fn(),
      createCustomer: vi.fn(),
      createSubscription: vi.fn().mockResolvedValue({
        id: "sub_rzp_fresh",
        short_url: "https://rzp.io/i/fresh",
      }),
    };

    const service = new SaasBillingService(prisma as never, razorpay as never);
    const result = await service.collectPayment("org_1");

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { razorpaySubId: null, razorpayShortUrl: null },
      }),
    );
    expect(razorpay.createSubscription).toHaveBeenCalled();
    expect(result.shortUrl).toBe("https://rzp.io/i/fresh");
  });
});

describe("SaasBillingService plan visibility", () => {
  it("listActivePlans returns only active public plans", async () => {
    const prisma = {
      plan: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "p1",
            slug: "starter",
            name: "Starter",
            description: null,
            priceMonthly: 999,
            priceYearly: 9990,
            maxOutlets: 1,
            maxTerminals: 2,
            maxUsers: 5,
          },
        ]),
      },
    };
    const service = new SaasBillingService(prisma as never, {} as never);
    const plans = await service.listActivePlans();

    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, visibility: "public" },
      }),
    );
    expect(plans).toHaveLength(1);
    expect(plans[0].slug).toBe("starter");
    expect(plans[0].priceMonthly).toBe(999);
  });

  it("activatePlan rejects private plans", async () => {
    const prisma = {
      plan: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p_priv",
          slug: "acme-deal",
          isActive: true,
          visibility: "private",
        }),
      },
    };
    const service = new SaasBillingService(prisma as never, {} as never);

    await expect(service.activatePlan("org_1", "acme-deal")).rejects.toMatchObject({
      status: 404,
      message: "Plan not found",
    });
  });

  it("activatePlan on a paying tenant keeps the current plan until first charge", async () => {
    const plan = makePlan({ id: "plan_pro", slug: "pro", visibility: "public", isActive: true, razorpayPlanIdMonthly: "rzp_plan_pro" });
    const current = makeSubscription({ status: "active", planId: "plan_1", razorpaySubId: "sub_rzp_old" });
    const prisma = {
      plan: { findUnique: vi.fn().mockResolvedValue(plan) },
      organization: { findUnique: vi.fn().mockResolvedValue(makeOrg({ razorpayCustomerId: "cust_ok" })) },
      subscription: {
        findFirst: vi.fn().mockResolvedValue(current),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...current, pendingRazorpaySubId: null }),
        update: vi.fn(),
      },
      subscriptionEntitlement: { deleteMany: vi.fn() },
      $transaction: vi.fn(),
    };
    const razorpay = {
      requireConfigured: vi.fn(),
      keyId: vi.fn().mockReturnValue("rzp_test_key"),
      fetchPlan: vi.fn().mockResolvedValue({ id: "rzp_plan_pro" }),
      fetchCustomer: vi.fn().mockResolvedValue({ id: "cust_ok" }),
      createSubscription: vi.fn().mockResolvedValue({ id: "sub_rzp_new", short_url: null }),
      cancelSubscription: vi.fn(),
    };
    const service = new SaasBillingService(prisma as never, razorpay as never);
    await service.activatePlan("org_1", "pro");

    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { pendingPlanId: "plan_pro", pendingRazorpaySubId: "sub_rzp_new" },
    });
  });

  it("activatePlan rejects inactive public plans", async () => {
    const prisma = {
      plan: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p_off",
          slug: "starter",
          isActive: false,
          visibility: "public",
        }),
      },
    };
    const service = new SaasBillingService(prisma as never, {} as never);

    await expect(service.activatePlan("org_1", "starter")).rejects.toMatchObject({
      status: 404,
      message: "Plan not found",
    });
  });
});

describe("SaasBillingService webhooks", () => {
  function webhookPrisma(subscription: Record<string, unknown>) {
    return {
      subscription: {
        findFirst: vi.fn().mockImplementation(async ({ where }: { where: { OR?: Array<Record<string, string>> } }) => {
          const id = where.OR?.[0]?.razorpaySubId;
          if (!id) return subscription;
          return id === subscription.razorpaySubId || id === subscription.pendingRazorpaySubId
            ? subscription
            : null;
        }),
        findUnique: vi.fn().mockResolvedValue(subscription),
        update: vi.fn(),
      },
      organization: { update: vi.fn() },
      planFeature: { findMany: vi.fn().mockResolvedValue([]) },
      subscriptionEntitlement: { deleteMany: vi.fn() },
      $transaction: vi.fn(),
    };
  }

  it("ignores a cancel event for a superseded gateway subscription", async () => {
    const prisma = webhookPrisma(
      makeSubscription({ status: "active", razorpaySubId: "sub_rzp_new", pendingRazorpaySubId: null }),
    );
    const service = new SaasBillingService(prisma as never, {} as never);
    const result = await service.applyWebhook("subscription.cancelled", {
      subscription: {
        entity: {
          id: "sub_rzp_old",
          status: "cancelled",
          notes: { subscriptionId: "sub_1", organizationId: "org_1" },
        },
      },
    });
    expect(result).toEqual({ handled: false });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it("does not activate on an authenticated-only mandate", async () => {
    const prisma = webhookPrisma(makeSubscription({ status: "past_due", razorpaySubId: "sub_rzp_1" }));
    const service = new SaasBillingService(prisma as never, {} as never);
    const result = await service.applyWebhook("subscription.authenticated", {
      subscription: { entity: { id: "sub_rzp_1", status: "authenticated" } },
    });
    expect(result.status).toBeUndefined();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("promotes the pending plan on its first charge and cancels the old gateway sub", async () => {
    const prisma = webhookPrisma(
      makeSubscription({
        status: "active",
        planId: "plan_1",
        razorpaySubId: "sub_rzp_old",
        pendingPlanId: "plan_pro",
        pendingRazorpaySubId: "sub_rzp_new",
      }),
    );
    const razorpay = { cancelSubscription: vi.fn().mockResolvedValue(undefined) };
    const service = new SaasBillingService(prisma as never, razorpay as never);
    const result = await service.applyWebhook("subscription.charged", {
      subscription: { entity: { id: "sub_rzp_new", status: "active" } },
      payment: { entity: { id: "pay_1" } },
    });
    expect(result).toMatchObject({ handled: true, status: "active" });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planId: "plan_pro",
          razorpaySubId: "sub_rzp_new",
          pendingPlanId: null,
          pendingRazorpaySubId: null,
        }),
      }),
    );
    expect(razorpay.cancelSubscription).toHaveBeenCalledWith("sub_rzp_old");
  });
});

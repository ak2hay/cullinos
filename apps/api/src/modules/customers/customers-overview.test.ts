import { describe, expect, it, vi } from "vitest";
import { CustomersService } from "./customers.service";

const customers = [
  { id: "c1", organizationId: "org_1", name: "Asha", loyaltyPoints: 50, createdAt: new Date("2026-01-01") },
  { id: "c2", organizationId: "org_1", name: "Bilal", loyaltyPoints: 400, createdAt: new Date("2026-02-01") },
  { id: "c3", organizationId: "org_1", name: "Chitra", loyaltyPoints: 0, createdAt: new Date("2026-03-01") },
];

const groups = [
  { customerId: "c1", _count: { _all: 2 }, _sum: { total: 900 }, _max: { createdAt: new Date("2026-10-01") } },
  { customerId: "c2", _count: { _all: 5 }, _sum: { total: 300.5 }, _max: { createdAt: new Date("2026-09-01") } },
];

function makeService() {
  const prisma = {
    customer: {
      count: vi.fn().mockResolvedValue(customers.length),
      aggregate: vi.fn().mockResolvedValue({ _sum: { loyaltyPoints: 450 }, _count: { _all: 3 } }),
      findMany: vi.fn(async (args: { where: { id?: { in: string[] }; orders?: unknown }; select?: unknown }) => {
        if (args.where.id?.in) return customers.filter((c) => args.where.id!.in.includes(c.id));
        if (args.where.orders) return [{ id: "c3" }];
        return customers.map((c) => ({ id: c.id }));
      }),
    },
    order: {
      groupBy: vi.fn(async (args: { where: { customerId?: { in?: string[] } } }) => {
        const ids = args.where.customerId?.in;
        return ids ? groups.filter((g) => ids.includes(g.customerId)) : groups;
      }),
    },
  };
  const service = new CustomersService(prisma as never, {} as never, {} as never, {} as never);
  return { service, prisma };
}

describe("CustomersService.overview", () => {
  it("ranks by spend, appends customers with no visits, and returns paise", async () => {
    const { service, prisma } = makeService();

    const result = await service.overview("org_1", { sort: "spent" });

    expect(result.data.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(result.data[0]).toMatchObject({ visits: 2, totalSpent: 90000 });
    expect(result.data[1]).toMatchObject({ visits: 5, totalSpent: 30050 });
    expect(result.data[2]).toMatchObject({ visits: 0, totalSpent: 0, lastVisitAt: null });
    expect(result.summary).toEqual({ totalCustomers: 3, totalPoints: 450 });
    for (const call of prisma.order.groupBy.mock.calls) {
      expect(call[0].where).toMatchObject({ organizationId: "org_1" });
    }
  });

  it("ranks by visit count", async () => {
    const { service } = makeService();
    const result = await service.overview("org_1", { sort: "visits" });
    expect(result.data.map((c) => c.id).slice(0, 2)).toEqual(["c2", "c1"]);
  });

  it("scopes every customer query to the organization", async () => {
    const { service, prisma } = makeService();
    await service.overview("org_1", { sort: "points", q: "98765 43210" });
    for (const call of prisma.customer.findMany.mock.calls) {
      expect((call[0] as { where: { organizationId: string } }).where.organizationId).toBe("org_1");
    }
    expect(prisma.customer.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: "org_1",
        OR: expect.arrayContaining([{ phone: { contains: "9876543210" } }]),
      }),
    });
  });
});

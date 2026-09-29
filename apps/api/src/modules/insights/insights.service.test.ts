import { describe, expect, it, vi } from "vitest";
import { InsightsService } from "./insights.service";

describe("InsightsService.list", () => {
  it("only returns snapshots for the caller's outlets", async () => {
    const prisma = {
      outlet: { findMany: vi.fn(async () => [{ id: "o1" }, { id: "o2" }]) },
      insightsSnapshot: { findMany: vi.fn(async () => []) },
    };
    await new InsightsService(prisma as never).list("org_1");
    expect(prisma.outlet.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      select: { id: true },
    });
    expect(prisma.insightsSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { outletId: { in: ["o1", "o2"] } } }),
    );
  });

  it("returns nothing for an org without outlets", async () => {
    const prisma = {
      outlet: { findMany: vi.fn(async () => []) },
      insightsSnapshot: { findMany: vi.fn() },
    };
    expect(await new InsightsService(prisma as never).list("org_1")).toEqual([]);
    expect(prisma.insightsSnapshot.findMany).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { CustomerAutoMergeService } from "./customer-auto-merge.service";

function setup(opts: { orgs?: string[]; leased?: boolean; failOrg?: string } = {}) {
  const prisma = {
    $queryRawUnsafe: vi.fn(async () => (opts.orgs ?? []).map((organizationId) => ({ organizationId }))),
  };
  const customers = {
    mergeDuplicates: vi.fn(async (orgId: string) => {
      if (orgId === opts.failOrg) throw new Error("boom");
      return { applied: true, duplicateCount: 2, normalizedCount: 1, groups: [] };
    }),
  };
  const redis = { acquireLock: vi.fn(async () => opts.leased ?? true) };
  const service = new CustomerAutoMergeService(prisma as never, customers as never, redis as never);
  return { service, prisma, customers, redis };
}

describe("CustomerAutoMergeService", () => {
  it("merges only the organizations returned by the duplicate scan", async () => {
    const { service, customers } = setup({ orgs: ["org_a", "org_b"] });

    const res = await service.runScheduledPass();

    expect(customers.mergeDuplicates.mock.calls).toEqual([
      ["org_a", true, undefined, "auto"],
      ["org_b", true, undefined, "auto"],
    ]);
    expect(res).toEqual({ orgs: 2, merged: 4, normalized: 2 });
  });

  it("does nothing when another instance holds the lock", async () => {
    const { service, prisma, customers } = setup({ orgs: ["org_a"], leased: false });

    expect(await service.runScheduledPass()).toBeNull();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(customers.mergeDuplicates).not.toHaveBeenCalled();
  });

  it("keeps going when one organization fails", async () => {
    const { service, customers } = setup({ orgs: ["org_a", "org_b"], failOrg: "org_a" });

    const res = await service.runScheduledPass();

    expect(customers.mergeDuplicates).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ orgs: 2, merged: 2, normalized: 1 });
  });
});

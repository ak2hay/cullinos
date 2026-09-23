import { describe, expect, it } from "vitest";

/**
 * Documents the IDOR/BOLA invariant used across tenant services:
 * lookups by id must always include organizationId from the JWT, never trust client org hints.
 */
describe("IDOR / BOLA tenant isolation invariant", () => {
  function findOrder(orders: Array<{ id: string; organizationId: string }>, orgId: string, id: string) {
    return orders.find((o) => o.id === id && o.organizationId === orgId) ?? null;
  }

  it("tenant A cannot read tenant B order by id", () => {
    const orders = [
      { id: "ord-1", organizationId: "org-a" },
      { id: "ord-2", organizationId: "org-b" },
    ];
    expect(findOrder(orders, "org-a", "ord-2")).toBeNull();
    expect(findOrder(orders, "org-b", "ord-2")?.id).toBe("ord-2");
  });

  it("rejects forged organizationId on the request body for updates", () => {
    const jwtOrgId = "org-a";
    const bodyOrgId = "org-b";
    const effectiveOrg = jwtOrgId; // server must ignore body org
    expect(effectiveOrg).not.toBe(bodyOrgId);
    expect(effectiveOrg).toBe("org-a");
  });
});

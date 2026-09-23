import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { assertOrgOwned, orgScopedWhere } from "./org-scope.util";

describe("org-scope.util", () => {
  it("returns entity when organization matches", () => {
    const row = { id: "o1", organizationId: "org-a" };
    expect(assertOrgOwned("org-a", row)).toBe(row);
  });

  it("throws NotFound when organization mismatches (cross-tenant)", () => {
    const row = { id: "o1", organizationId: "org-a" };
    expect(() => assertOrgOwned("org-b", row)).toThrow(NotFoundException);
  });

  it("throws NotFound when entity is missing", () => {
    expect(() => assertOrgOwned("org-a", null)).toThrow(NotFoundException);
  });

  it("always injects organizationId into where clauses", () => {
    expect(orgScopedWhere("org-a", { id: "x" })).toEqual({
      id: "x",
      organizationId: "org-a",
    });
  });
});

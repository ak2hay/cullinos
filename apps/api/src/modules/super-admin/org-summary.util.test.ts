import { describe, expect, it } from "vitest";
import { summarizeOrgCounts } from "./org-summary.util";

const extras = {
  deleted: 2,
  outlets: 8,
  users: 13,
  newThisMonth: 1,
  totalAtMonthStart: 7,
  usersAtMonthStart: 11,
};

describe("summarizeOrgCounts", () => {
  it("folds status counts and keeps extras", () => {
    const summary = summarizeOrgCounts(
      [
        { status: "active", _count: { _all: 5 } },
        { status: "trial", _count: { _all: 2 } },
        { status: "suspended", _count: { _all: 1 } },
      ],
      extras,
    );
    expect(summary).toEqual({
      total: 8,
      active: 5,
      trial: 2,
      suspended: 1,
      cancelled: 0,
      ...extras,
    });
  });

  it("returns zeros when there are no tenants", () => {
    const summary = summarizeOrgCounts([], { ...extras, deleted: 0 });
    expect(summary.total).toBe(0);
    expect(summary.active).toBe(0);
    expect(summary.deleted).toBe(0);
  });
});

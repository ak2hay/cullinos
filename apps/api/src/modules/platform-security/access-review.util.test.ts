import { describe, expect, it } from "vitest";
import { isReadOnlyBlocked } from "../../common/support-session.guard";
import { averageHours, csvCell, toCsv } from "../platform-reports/csv.util";
import {
  buildReviewItems,
  campaignProgress,
  parsePrimaryAssignmentId,
  primaryAssignmentId,
} from "./access-review.util";

describe("access review items", () => {
  it("assigns the manager as reviewer, never the employee themself", () => {
    const items = buildReviewItems([
      { assignmentId: "a1", userId: "u1", roleKey: "support", managerUserId: "m1" },
      { assignmentId: "a2", userId: "u2", roleKey: "owner", managerUserId: "u2" },
      { assignmentId: "a3", userId: "u3", roleKey: "sales", managerUserId: null },
    ]);
    expect(items.map((i) => i.reviewerId)).toEqual(["m1", null, null]);
  });

  it("round-trips primary role ids", () => {
    expect(parsePrimaryAssignmentId(primaryAssignmentId("u9"))).toBe("u9");
    expect(parsePrimaryAssignmentId("cuid123")).toBeNull();
  });

  it("reports progress", () => {
    expect(campaignProgress([{ decision: "pending" }, { decision: "certified" }, { decision: "revoked" }, { decision: "certified" }])).toEqual({
      total: 4,
      pending: 1,
      certified: 2,
      revoked: 1,
      percentDone: 75,
    });
    expect(campaignProgress([]).percentDone).toBe(100);
  });
});

describe("read-only support sessions", () => {
  it("allows reads and logout, blocks writes", () => {
    expect(isReadOnlyBlocked("GET", "/api/v1/orders")).toBe(false);
    expect(isReadOnlyBlocked("POST", "/api/v1/auth/logout")).toBe(false);
    expect(isReadOnlyBlocked("POST", "/api/v1/orders")).toBe(true);
    expect(isReadOnlyBlocked("DELETE", "/api/v1/menu/items/1")).toBe(true);
  });
});

describe("csv export helpers", () => {
  it("quotes and neutralises spreadsheet formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["x", "y"], [[1, "two"]])).toBe("x,y\n1,two");
  });

  it("averages durations in hours", () => {
    const t = new Date("2026-10-01T00:00:00Z");
    expect(
      averageHours([
        { start: t, end: new Date(t.getTime() + 2 * 3600_000) },
        { start: t, end: new Date(t.getTime() + 4 * 3600_000) },
        { start: t, end: null },
      ]),
    ).toBe(3);
    expect(averageHours([])).toBeNull();
  });
});

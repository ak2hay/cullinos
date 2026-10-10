import { describe, expect, it } from "vitest";
import {
  conditionsMatch,
  decisionBlocker,
  formatApprovalRef,
  parseConditions,
  payloadHash,
  statusAfterDecisions,
  stripApiPrefix,
} from "./approval.util";

describe("policy conditions", () => {
  it("drops malformed conditions", () => {
    expect(parseConditions([{ field: "a", op: "gt", value: 1 }, { field: "b", op: "nope" }, null])).toHaveLength(1);
    expect(parseConditions("x")).toEqual([]);
  });

  it("applies every condition, including abs_gt and dotted paths", () => {
    const conds = parseConditions([{ field: "amountPaise", op: "abs_gt", value: 5_000_000 }]);
    expect(conditionsMatch(conds, { amountPaise: -6_000_000 })).toBe(true);
    expect(conditionsMatch(conds, { amountPaise: 100 })).toBe(false);
    expect(conditionsMatch(parseConditions([{ field: "plan.tier", op: "in", value: ["pro", "ent"] }]), { plan: { tier: "pro" } })).toBe(true);
    expect(conditionsMatch([], {})).toBe(true);
  });
});

describe("payloadHash", () => {
  it("binds method, path, query and body regardless of key order", () => {
    const a = payloadHash({ method: "put", path: "/super-admin/settings", query: {}, body: { a: 1, b: 2 } });
    const b = payloadHash({ method: "PUT", path: "/super-admin/settings", query: {}, body: { b: 2, a: 1 } });
    const c = payloadHash({ method: "PUT", path: "/super-admin/settings", query: {}, body: { a: 1, b: 3 } });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("helpers", () => {
  it("strips the api prefix and query", () => {
    expect(stripApiPrefix("/api/v1/super-admin/plans/x?y=1")).toBe("/super-admin/plans/x");
  });

  it("formats refs", () => {
    expect(formatApprovalRef(7)).toBe("APR-000007");
  });
});

describe("decisions", () => {
  const base = {
    approverId: "a",
    requestedById: "r",
    blockSelfApproval: true,
    eligibleApproverIds: new Set(["a", "r"]),
    alreadyDecided: false,
  };

  it("blocks self-approval, double votes and non-approvers", () => {
    expect(decisionBlocker(base)).toBeNull();
    expect(decisionBlocker({ ...base, approverId: "r" })).toMatch(/own request/);
    expect(decisionBlocker({ ...base, alreadyDecided: true })).toMatch(/already/);
    expect(decisionBlocker({ ...base, approverId: "z" })).toMatch(/not an approver/);
  });

  it("rejects on any rejection and approves at quorum", () => {
    expect(statusAfterDecisions([{ decision: "approved" }], 2)).toBe("pending");
    expect(statusAfterDecisions([{ decision: "approved" }, { decision: "approved" }], 2)).toBe("approved");
    expect(statusAfterDecisions([{ decision: "approved" }, { decision: "rejected" }], 1)).toBe("rejected");
  });
});

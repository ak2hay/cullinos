import { describe, expect, it } from "vitest";
import {
  activityHash,
  canonicalJson,
  describeRoute,
  redactForLog,
  verifyActivityChain,
  type ActivityHashFields,
} from "./platform-activity.util";
import { formatEmployeeCode, nextEmployeeCode, parseEmployeeCode } from "./employee-code.util";

function fields(action: string): ActivityHashFields {
  return {
    userId: "u1",
    employeeCode: "RKY-000001",
    action,
    resourceType: null,
    resourceId: null,
    targetOrgId: null,
    statusCode: 200,
    approvalRequestId: null,
    ticketId: null,
    grantId: null,
    diff: null,
    metadata: { b: 1, a: 2 },
    createdAt: "2026-10-08T00:00:00.000Z",
  };
}

describe("redactForLog", () => {
  it("masks secret-looking keys at any depth", () => {
    expect(redactForLog({ password: "x", nested: { apiKey: "k", name: "ok" } })).toEqual({
      password: "[redacted]",
      nested: { apiKey: "[redacted]", name: "ok" },
    });
  });
});

describe("canonicalJson", () => {
  it("is independent of key order", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });
});

describe("activity hash chain", () => {
  function chain() {
    const f1 = fields("GET /a");
    const h1 = activityHash(null, f1);
    const f2 = fields("POST /b");
    const h2 = activityHash(h1, f2);
    return [
      { ...f1, id: "1", prevHash: null, hash: h1 },
      { ...f2, id: "2", prevHash: h1, hash: h2 },
    ];
  }

  it("verifies an intact chain", () => {
    expect(verifyActivityChain(chain())).toEqual({ ok: true, checked: 2, brokenAt: null });
  });

  it("detects a tampered row", () => {
    const rows = chain();
    rows[1] = { ...rows[1], action: "POST /evil" };
    expect(verifyActivityChain(rows)).toMatchObject({ ok: false, brokenAt: "2" });
  });
});

describe("describeRoute", () => {
  it("extracts resource and target tenant", () => {
    expect(
      describeRoute("post", "/api/v1/super-admin/organizations/:id/suspend", { id: "org_9" }, "/api/v1/super-admin/organizations/org_9/suspend?x=1"),
    ).toEqual({
      action: "POST /super-admin/organizations/:id/suspend",
      resourceType: "organizations",
      resourceId: "org_9",
      targetOrgId: "org_9",
    });
  });

  it("does not treat plan ids as tenants", () => {
    expect(describeRoute("patch", "/api/v1/super-admin/plans/:id", { id: "p1" }, "/api/v1/super-admin/plans/p1").targetOrgId).toBeNull();
  });
});

describe("employee codes", () => {
  it("formats, parses and increments", () => {
    expect(formatEmployeeCode(42)).toBe("RKY-000042");
    expect(parseEmployeeCode("RKY-000042")).toBe(42);
    expect(parseEmployeeCode("EMP-1")).toBeNull();
    expect(nextEmployeeCode(["RKY-000002", "RKY-000010", "junk"])).toBe("RKY-000011");
    expect(nextEmployeeCode([])).toBe("RKY-000001");
  });
});

import { createHash } from "crypto";
import { canonicalJson } from "../platform-iam/platform-activity.util";

export type ConditionOp = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "in" | "abs_gt";

export type PolicyCondition = { field: string; op: ConditionOp; value: unknown };

const OPS: readonly ConditionOp[] = ["gt", "gte", "lt", "lte", "eq", "neq", "in", "abs_gt"];

export function parseConditions(raw: unknown): PolicyCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is PolicyCondition =>
      Boolean(c) &&
      typeof c === "object" &&
      typeof (c as PolicyCondition).field === "string" &&
      OPS.includes((c as PolicyCondition).op),
  );
}

function readPath(facts: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, facts);
}

/** A policy applies only when every condition holds (no conditions = always). */
export function conditionsMatch(conditions: readonly PolicyCondition[], facts: Record<string, unknown>) {
  return conditions.every((c) => {
    const actual = readPath(facts, c.field);
    const n = Number(actual);
    const v = Number(c.value);
    switch (c.op) {
      case "gt":
        return Number.isFinite(n) && n > v;
      case "gte":
        return Number.isFinite(n) && n >= v;
      case "lt":
        return Number.isFinite(n) && n < v;
      case "lte":
        return Number.isFinite(n) && n <= v;
      case "abs_gt":
        return Number.isFinite(n) && Math.abs(n) > v;
      case "eq":
        return String(actual) === String(c.value);
      case "neq":
        return String(actual) !== String(c.value);
      case "in":
        return Array.isArray(c.value) && c.value.map(String).includes(String(actual));
      default:
        return false;
    }
  });
}

export type ReplayPayload = {
  method: string;
  /** Path below /api/v1, e.g. /super-admin/plans/abc */
  path: string;
  query: Record<string, unknown>;
  body: unknown;
};

/** Binds an approval to the exact request: same method, path, query and body. */
export function payloadHash(p: ReplayPayload): string {
  return createHash("sha256")
    .update(canonicalJson({ ...p, method: p.method.toUpperCase() }))
    .digest("hex");
}

export function stripApiPrefix(url: string): string {
  const path = url.split("?")[0] ?? "";
  return path.replace(/^\/api\/v\d+/, "") || "/";
}

export function formatApprovalRef(seq: number): string {
  return `APR-${String(seq).padStart(6, "0")}`;
}

export type DecisionContext = {
  approverId: string;
  requestedById: string;
  blockSelfApproval: boolean;
  eligibleApproverIds: ReadonlySet<string>;
  alreadyDecided: boolean;
};

/** Returns the reason an approver may not decide, or null when allowed. */
export function decisionBlocker(ctx: DecisionContext): string | null {
  if (ctx.blockSelfApproval && ctx.approverId === ctx.requestedById) {
    return "You cannot approve your own request";
  }
  if (ctx.alreadyDecided) return "You have already decided on this request";
  if (!ctx.eligibleApproverIds.has(ctx.approverId)) {
    return "You are not an approver for this request";
  }
  return null;
}

/** Status after a decision: any rejection rejects; enough approvals approve. */
export function statusAfterDecisions(
  decisions: readonly { decision: string }[],
  requiredApprovals: number,
): "pending" | "approved" | "rejected" {
  if (decisions.some((d) => d.decision === "rejected")) return "rejected";
  const approvals = decisions.filter((d) => d.decision === "approved").length;
  return approvals >= Math.max(1, requiredApprovals) ? "approved" : "pending";
}

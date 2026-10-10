import type { PolicyCondition } from "./approval.util";

export type DefaultPolicy = {
  actionKey: string;
  name: string;
  description: string;
  requiredApprovals: number;
  approverRoleKeys: string[];
  expiryHours: number;
  isActive: boolean;
  conditions?: PolicyCondition[];
};

/**
 * Seeded once (never overwritten) so owners can tune them in Governance → Approval
 * policies. Every action key used with @RequiresApproval or a domain approval is listed.
 */
export const DEFAULT_APPROVAL_POLICIES: readonly DefaultPolicy[] = [
  {
    actionKey: "tenants.delete",
    name: "Delete tenant",
    description: "Soft-deletes a restaurant account. Two owners must agree.",
    requiredApprovals: 2,
    approverRoleKeys: ["owner"],
    expiryHours: 48,
    isActive: true,
  },
  {
    actionKey: "tenants.suspend",
    name: "Suspend tenant",
    description: "Blocks every login for the tenant.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner", "support"],
    expiryHours: 24,
    isActive: false,
  },
  {
    actionKey: "subscriptions.change",
    name: "Change subscription",
    description: "Plan or status change on a tenant subscription.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner", "finance"],
    expiryHours: 72,
    isActive: false,
  },
  {
    actionKey: "plans.create",
    name: "Create plan",
    description: "New plan in the SaaS catalog.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner", "finance"],
    expiryHours: 72,
    isActive: true,
  },
  {
    actionKey: "plans.update",
    name: "Change plan price or limits",
    description: "Edits to the SaaS plan catalog.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner", "finance"],
    expiryHours: 72,
    isActive: true,
  },
  {
    actionKey: "wallet.adjust",
    name: "Large wallet adjustment",
    description: "Manual wallet credit/debit above ₹50,000.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner", "finance"],
    expiryHours: 48,
    isActive: true,
    conditions: [{ field: "amountPaise", op: "abs_gt", value: 5_000_000 }],
  },
  {
    actionKey: "settings.update",
    name: "Platform settings / integration keys",
    description: "SMTP, SMS, payment and other platform keys.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 24,
    isActive: true,
  },
  {
    actionKey: "security.update",
    name: "Security policy change",
    description: "IP allowlists and step-up rules.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 24,
    isActive: true,
  },
  {
    actionKey: "iam.assign",
    name: "Grant critical role",
    description: "Granting a role that includes any critical permission.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 72,
    isActive: true,
    conditions: [{ field: "maxRisk", op: "eq", value: "critical" }],
  },
  {
    actionKey: "iam.elevate",
    name: "Just-in-time elevation",
    description: "Temporary extra role for a few hours, requested by the employee.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 8,
    isActive: true,
  },
  {
    actionKey: "iam.role_create",
    name: "Create custom role",
    description: "New role definition.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 72,
    isActive: true,
  },
  {
    actionKey: "iam.role_update",
    name: "Change custom role",
    description: "Permission changes apply to everyone holding the role.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 72,
    isActive: true,
  },
  {
    actionKey: "tenant_access.read_only",
    name: "Read-only tenant access",
    description: "Ticket-backed, time-boxed view of a restaurant account.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner", "support"],
    expiryHours: 8,
    isActive: true,
  },
  {
    actionKey: "tenant_access.full",
    name: "Full tenant access",
    description: "Ticket-backed, time-boxed access that can change restaurant data.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 8,
    isActive: true,
  },
  {
    actionKey: "activity.export",
    name: "Export staff activity log",
    description: "CSV of staff actions (contains IPs and emails).",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 48,
    isActive: true,
  },
  {
    actionKey: "reports.export",
    name: "Export report with personal data",
    description: "Tenant / user exports that include contact details.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 48,
    isActive: true,
  },
  {
    actionKey: "bulk.run",
    name: "Bulk tenant operation",
    description: "Runs one action across many tenants.",
    requiredApprovals: 1,
    approverRoleKeys: ["owner"],
    expiryHours: 24,
    isActive: true,
  },
];

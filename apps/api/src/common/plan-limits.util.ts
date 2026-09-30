import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";

export type PlanCapacity = "outlets" | "users" | "terminals";

const LABELS: Record<PlanCapacity, string> = {
  outlets: "outlets",
  users: "staff accounts",
  terminals: "POS terminals",
};

async function currentCount(
  prisma: PrismaService,
  organizationId: string,
  kind: PlanCapacity,
): Promise<number> {
  switch (kind) {
    case "outlets":
      return prisma.outlet.count({ where: { organizationId } });
    case "users":
      return prisma.user.count({
        where: { organizationId, isSuperAdmin: false, status: { not: "inactive" } },
      });
    case "terminals":
      return prisma.device.count({ where: { organizationId, type: "pos" } });
  }
}

/**
 * Rejects creating one more outlet / user / POS terminal beyond the org's current plan.
 * Orgs without a subscription (legacy rows) are not limited.
 */
export async function assertPlanCapacity(
  prisma: PrismaService,
  organizationId: string,
  kind: PlanCapacity,
): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { plan: { select: { name: true, maxOutlets: true, maxUsers: true, maxTerminals: true } } },
  });
  const plan = subscription?.plan;
  if (!plan) return;
  const limit =
    kind === "outlets" ? plan.maxOutlets : kind === "users" ? plan.maxUsers : plan.maxTerminals;
  const used = await currentCount(prisma, organizationId, kind);
  if (used >= limit) {
    throw new ForbiddenException({
      code: "PLAN_LIMIT_REACHED",
      message: `Your ${plan.name} plan allows ${limit} ${LABELS[kind]}. Upgrade the plan to add more.`,
      details: { kind, limit, used },
    });
  }
}

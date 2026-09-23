/** Assert a resource belongs to the caller's organization (IDOR/BOLA guard). */

import { NotFoundException } from "@nestjs/common";

/**
 * Returns the entity if present and scoped to orgId; otherwise throws NotFoundException
 * (404 instead of 403 to avoid confirming existence across tenants).
 */
export function assertOrgOwned<T extends { organizationId: string }>(
  orgId: string,
  entity: T | null | undefined,
  message = "Resource not found",
): T {
  if (!entity || entity.organizationId !== orgId) {
    throw new NotFoundException(message);
  }
  return entity;
}

/**
 * Builds a Prisma-style where clause that always includes organizationId.
 */
export function orgScopedWhere<T extends Record<string, unknown>>(
  orgId: string,
  where: T,
): T & { organizationId: string } {
  return { ...where, organizationId: orgId };
}

import { BadRequestException } from "@nestjs/common";

export function toApiStatus(value: string): string {
  return value.toUpperCase();
}

export function fromApiStatus(value: string): string {
  return value.toLowerCase();
}

export function toApiTableStatus(value: string): string {
  return value.toUpperCase();
}

export function fromApiTableStatus(value: string): string {
  return value.toLowerCase();
}

const ORDER_STATUS_VALUES = new Set([
  "draft",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
  "voided",
]);

const ORDER_STATUS_ALIASES: Record<string, string> = {
  held: "draft",
  pending: "draft",
  canceled: "cancelled",
};

/** Map API order status (any casing / legacy alias) to the Prisma enum; 400 on unknown values. */
export function normalizeOrderStatusFilter(value: string): string {
  const lower = fromApiStatus(value.trim());
  const status = ORDER_STATUS_ALIASES[lower] ?? lower;
  if (!ORDER_STATUS_VALUES.has(status)) {
    throw new BadRequestException(`Invalid order status: ${value}`);
  }
  return status;
}

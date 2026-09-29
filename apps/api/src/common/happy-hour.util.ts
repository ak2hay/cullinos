import type { PrismaService } from "../prisma/prisma.service";

export const HAPPY_HOUR_DISCOUNT_TYPES = ["percent", "amount"] as const;
export type HappyHourDiscountType = (typeof HAPPY_HOUR_DISCOUNT_TYPES)[number];

export type HappyHourRuleLike = {
  id: string;
  name: string;
  outletId: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  discountType: string;
  discountValue: number;
  categoryIds: string[];
  menuItemIds: string[];
};

export type LocalClock = { day: number; minutes: number };

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** "HH:mm" → minutes since midnight, or null when malformed. */
export function parseHm(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Day-of-week (0 = Sunday) and minutes since midnight in the given IANA timezone. */
export function localClock(now: Date, timeZone: string): LocalClock {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: WEEKDAY_INDEX[get("weekday")] ?? now.getUTCDay(),
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

/** Windows with endTime <= startTime run overnight and belong to the day they start on. */
export function isRuleActiveAt(
  rule: Pick<HappyHourRuleLike, "daysOfWeek" | "startTime" | "endTime">,
  clock: LocalClock,
): boolean {
  const start = parseHm(rule.startTime);
  const end = parseHm(rule.endTime);
  if (start == null || end == null || start === end) return false;
  if (start < end) {
    return rule.daysOfWeek.includes(clock.day) && clock.minutes >= start && clock.minutes < end;
  }
  const previousDay = (clock.day + 6) % 7;
  return (
    (rule.daysOfWeek.includes(clock.day) && clock.minutes >= start) ||
    (rule.daysOfWeek.includes(previousDay) && clock.minutes < end)
  );
}

export function ruleMatchesItem(
  rule: Pick<HappyHourRuleLike, "categoryIds" | "menuItemIds">,
  item: { menuItemId: string; categoryId: string },
): boolean {
  if (rule.categoryIds.length === 0 && rule.menuItemIds.length === 0) return true;
  return rule.menuItemIds.includes(item.menuItemId) || rule.categoryIds.includes(item.categoryId);
}

export function applyDiscount(
  priceRupees: number,
  rule: Pick<HappyHourRuleLike, "discountType" | "discountValue">,
): number {
  const value = Number(rule.discountValue);
  if (!Number.isFinite(value) || value <= 0) return priceRupees;
  const next =
    rule.discountType === "amount"
      ? priceRupees - value
      : priceRupees * (1 - Math.min(value, 100) / 100);
  return Math.max(0, Math.round(next * 100) / 100);
}

/** Lowest happy-hour price among matching rules, or null when no rule lowers the price. */
export function bestHappyHourPrice(
  priceRupees: number,
  item: { menuItemId: string; categoryId: string },
  rules: HappyHourRuleLike[],
): { price: number; rule: HappyHourRuleLike } | null {
  let best: { price: number; rule: HappyHourRuleLike } | null = null;
  for (const rule of rules) {
    if (!ruleMatchesItem(rule, item)) continue;
    const price = applyDiscount(priceRupees, rule);
    if (price < priceRupees && (!best || price < best.price)) best = { price, rule };
  }
  return best;
}

/** Active rules for an outlet right now (org timezone), including all-outlet rules. */
export async function loadActiveHappyHourRules(
  prisma: PrismaService,
  orgId: string,
  outletId: string,
  now: Date = new Date(),
): Promise<HappyHourRuleLike[]> {
  const [org, rows] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { timezone: true } }),
    prisma.happyHourRule.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        OR: [{ outletId: null }, { outletId }],
      },
    }),
  ]);
  if (rows.length === 0) return [];
  const clock = localClock(now, org?.timezone || "Asia/Kolkata");
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      outletId: r.outletId,
      daysOfWeek: r.daysOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      discountType: r.discountType,
      discountValue: Number(r.discountValue),
      categoryIds: r.categoryIds,
      menuItemIds: r.menuItemIds,
    }))
    .filter((r) => isRuleActiveAt(r, clock));
}

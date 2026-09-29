import { BadRequestException } from "@nestjs/common";
import { orgServesAlcohol } from "@cullinos/shared";
import type { PrismaService } from "../prisma/prisma.service";

export const BAR_STATION = { code: "BAR", name: "Bar" } as const;

const STATION_CODE_RE = /^[A-Z0-9_-]{1,20}$/;

/** Uppercased station code, or null when cleared. Throws on invalid codes. */
export function normalizeStationCode(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new BadRequestException("Invalid kitchenStationCode");
  const code = value.trim().toUpperCase();
  if (!code) return null;
  if (!STATION_CODE_RE.test(code)) {
    throw new BadRequestException(
      "kitchenStationCode must be 1–20 letters, digits, _ or -",
    );
  }
  return code;
}

/** Idempotently create the Bar station at every outlet of the organization. */
export async function ensureBarStations(db: PrismaService, organizationId: string): Promise<void> {
  const outlets = await db.outlet.findMany({
    where: { organizationId },
    select: { id: true },
  });
  for (const outlet of outlets) {
    await db.kitchenStation.upsert({
      where: { outletId_code: { outletId: outlet.id, code: BAR_STATION.code } },
      update: {},
      create: {
        outletId: outlet.id,
        code: BAR_STATION.code,
        name: BAR_STATION.name,
        sortOrder: 10,
      },
    });
  }
}

/**
 * Create the Bar station at every outlet when the organization serves alcohol
 * (bar type, or restaurant/cafe with the alcohol setting on). Never removes stations.
 */
export async function ensureBarStationsIfServingAlcohol(
  db: PrismaService,
  organizationId: string,
): Promise<boolean> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { businessType: true, settings: { select: { settings: true } } },
  });
  if (!org) return false;
  const serves = orgServesAlcohol(org.businessType, org.settings?.settings);
  if (serves) await ensureBarStations(db, organizationId);
  return serves;
}

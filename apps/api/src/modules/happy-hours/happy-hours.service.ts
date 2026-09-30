import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  HAPPY_HOUR_DISCOUNT_TYPES,
  loadActiveHappyHourRules,
  parseHm,
} from "../../common/happy-hour.util";

type HappyHourInput = {
  name?: unknown;
  outletId?: unknown;
  daysOfWeek?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  categoryIds?: unknown;
  menuItemIds?: unknown;
  isActive?: unknown;
};

type HappyHourRow = {
  id: string;
  name: string;
  outletId: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  discountType: string;
  discountValue: unknown;
  categoryIds: string[];
  menuItemIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapRule(r: HappyHourRow) {
  return {
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
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function stringIds(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new BadRequestException(`${field} must be an array of ids`);
  }
  return [...new Set(value as string[])];
}

@Injectable()
export class HappyHoursService {
  constructor(private prisma: PrismaService) {}

  async list(orgId: string) {
    const rows = await this.prisma.happyHourRule.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isActive: "desc" }, { startTime: "asc" }],
    });
    return rows.map(mapRule);
  }

  async active(orgId: string, outletId: string) {
    await this.assertOutlet(orgId, outletId);
    return loadActiveHappyHourRules(this.prisma, orgId, outletId);
  }

  async create(orgId: string, body: HappyHourInput) {
    const data = await this.validate(orgId, body, true);
    const row = await this.prisma.happyHourRule.create({
      data: { organizationId: orgId, ...(data as Required<typeof data>) },
    });
    return mapRule(row);
  }

  async update(orgId: string, id: string, body: HappyHourInput) {
    const existing = await this.prisma.happyHourRule.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Happy hour not found");
    const data = await this.validate(orgId, body, false);
    const start = data.startTime ?? existing.startTime;
    const end = data.endTime ?? existing.endTime;
    if (start === end) throw new BadRequestException("startTime and endTime must differ");
    const type = data.discountType ?? existing.discountType;
    const value = data.discountValue ?? Number(existing.discountValue);
    if (type === "percent" && value > 100) {
      throw new BadRequestException("Percent discount cannot exceed 100");
    }
    const row = await this.prisma.happyHourRule.update({ where: { id }, data });
    return mapRule(row);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.happyHourRule.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Happy hour not found");
    await this.prisma.happyHourRule.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertOutlet(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
      select: { id: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
  }

  private async validate(orgId: string, body: HappyHourInput, creating: boolean) {
    const data: {
      name?: string;
      outletId?: string | null;
      daysOfWeek?: number[];
      startTime?: string;
      endTime?: string;
      discountType?: string;
      discountValue?: number;
      categoryIds?: string[];
      menuItemIds?: string[];
      isActive?: boolean;
    } = {};

    if (body.name !== undefined || creating) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        throw new BadRequestException("name is required");
      }
      data.name = body.name.trim().slice(0, 80);
    }

    if (body.outletId !== undefined) {
      if (body.outletId === null || body.outletId === "") {
        data.outletId = null;
      } else if (typeof body.outletId === "string") {
        await this.assertOutlet(orgId, body.outletId);
        data.outletId = body.outletId;
      } else {
        throw new BadRequestException("Invalid outletId");
      }
    } else if (creating) {
      data.outletId = null;
    }

    if (body.daysOfWeek !== undefined || creating) {
      const days = body.daysOfWeek;
      if (
        !Array.isArray(days) ||
        days.length === 0 ||
        days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
      ) {
        throw new BadRequestException("daysOfWeek must list days 0 (Sun) – 6 (Sat)");
      }
      data.daysOfWeek = [...new Set(days as number[])].sort();
    }

    for (const field of ["startTime", "endTime"] as const) {
      if (body[field] !== undefined || creating) {
        const value = body[field];
        if (typeof value !== "string" || parseHm(value) == null) {
          throw new BadRequestException(`${field} must be HH:mm`);
        }
        data[field] = value.trim();
      }
    }
    if (creating && data.startTime === data.endTime) {
      throw new BadRequestException("startTime and endTime must differ");
    }

    if (body.discountType !== undefined || creating) {
      const type = body.discountType ?? "percent";
      if (!(HAPPY_HOUR_DISCOUNT_TYPES as readonly unknown[]).includes(type)) {
        throw new BadRequestException("discountType must be percent or amount");
      }
      data.discountType = type as string;
    }

    if (body.discountValue !== undefined || creating) {
      const value = Number(body.discountValue);
      if (!Number.isFinite(value) || value <= 0) {
        throw new BadRequestException("discountValue must be greater than 0");
      }
      const type = data.discountType;
      if (type === "percent" && value > 100) {
        throw new BadRequestException("Percent discount cannot exceed 100");
      }
      data.discountValue = Math.round(value * 100) / 100;
    }

    if (body.categoryIds !== undefined || creating) {
      const ids = stringIds(body.categoryIds ?? [], "categoryIds");
      if (ids.length) {
        const count = await this.prisma.menuCategory.count({
          where: { id: { in: ids }, organizationId: orgId },
        });
        if (count !== ids.length) throw new BadRequestException("Unknown category in categoryIds");
      }
      data.categoryIds = ids;
    }

    if (body.menuItemIds !== undefined || creating) {
      const ids = stringIds(body.menuItemIds ?? [], "menuItemIds");
      if (ids.length) {
        const count = await this.prisma.menuItem.count({
          where: { id: { in: ids }, organizationId: orgId },
        });
        if (count !== ids.length) throw new BadRequestException("Unknown item in menuItemIds");
      }
      data.menuItemIds = ids;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new BadRequestException("isActive must be boolean");
      data.isActive = body.isActive;
    }

    return data;
  }
}

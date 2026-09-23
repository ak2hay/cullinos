import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ALLOWED_TAX_RATE_TYPES,
  INDIA_TAX_PRESETS,
} from "./tax.presets";

type RateInput = { name: string; rate: number; type?: string };

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.taxGroup.findMany({
      where: { organizationId: orgId },
      include: { rates: true },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  private normalizeRates(rates: RateInput[]): Array<{
    name: string;
    rate: number;
    type: string;
  }> {
    if (!Array.isArray(rates) || rates.length === 0) {
      throw new BadRequestException("at least one rate is required");
    }

    const normalized = rates.map((r) => {
      if (!r.name?.trim()) throw new BadRequestException("rate name is required");
      if (!Number.isFinite(Number(r.rate))) {
        throw new BadRequestException("rate must be a number");
      }
      const type = (r.type?.trim() || "").toUpperCase();
      if (!ALLOWED_TAX_RATE_TYPES.has(type)) {
        throw new BadRequestException(
          `rate type must be one of ${[...ALLOWED_TAX_RATE_TYPES].join(", ")}`,
        );
      }
      return {
        name: r.name.trim(),
        rate: Number(r.rate),
        type,
      };
    });

    const types = new Set(normalized.map((r) => r.type));
    const isExciseOnly =
      types.size === 1 && types.has("EXCISE") && normalized.length === 1;
    const hasCgst = types.has("CGST");
    const hasSgst = types.has("SGST");
    const hasIgst = types.has("IGST");
    const hasExcise = types.has("EXCISE");

    if (isExciseOnly) return normalized;

    if (hasExcise && (hasCgst || hasSgst || hasIgst)) {
      throw new BadRequestException(
        "State Excise groups must not mix EXCISE with GST rate types",
      );
    }

    if (hasIgst && normalized.length === 1) return normalized;

    if (!hasCgst || !hasSgst) {
      throw new BadRequestException(
        "GST tax groups require both CGST and SGST rates",
      );
    }

    return normalized;
  }

  async createGroup(
    orgId: string,
    data: {
      name: string;
      rates: RateInput[];
      isInclusive?: boolean;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");
    const rates = this.normalizeRates(data.rates);

    return this.prisma.taxGroup.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        isInclusive: data.isInclusive ?? false,
        rates: {
          create: rates,
        },
      },
      include: { rates: true },
    });
  }

  async updateGroup(
    orgId: string,
    groupId: string,
    data: {
      name?: string;
      rates?: RateInput[];
      isInclusive?: boolean;
    },
  ) {
    const existing = await this.prisma.taxGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Tax group not found");

    const rates = data.rates ? this.normalizeRates(data.rates) : null;

    return this.prisma.$transaction(async (tx) => {
      if (rates) {
        await tx.taxRate.deleteMany({ where: { taxGroupId: groupId } });
        await tx.taxRate.createMany({
          data: rates.map((r) => ({
            taxGroupId: groupId,
            name: r.name,
            rate: r.rate,
            type: r.type,
          })),
        });
      }
      return tx.taxGroup.update({
        where: { id: groupId },
        data: {
          ...(data.name?.trim() ? { name: data.name.trim() } : {}),
          ...(typeof data.isInclusive === "boolean"
            ? { isInclusive: data.isInclusive }
            : {}),
        },
        include: { rates: true },
      });
    });
  }

  async deleteGroup(orgId: string, groupId: string) {
    const existing = await this.prisma.taxGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      include: { _count: { select: { menuItems: true } } },
    });
    if (!existing) throw new NotFoundException("Tax group not found");
    if (existing._count.menuItems > 0) {
      throw new BadRequestException(
        "Cannot delete tax group while menu items are linked to it",
      );
    }
    await this.prisma.taxRate.deleteMany({ where: { taxGroupId: groupId } });
    await this.prisma.taxGroup.delete({ where: { id: groupId } });
    return { ok: true };
  }

  /** Idempotent: create missing India GST presets by exact name match. */
  async ensurePresets(orgId: string) {
    const existing = await this.prisma.taxGroup.findMany({
      where: { organizationId: orgId },
      select: { name: true },
    });
    const names = new Set(existing.map((g) => g.name));
    const created: string[] = [];

    for (const preset of INDIA_TAX_PRESETS) {
      if (names.has(preset.name)) continue;
      await this.prisma.taxGroup.create({
        data: {
          organizationId: orgId,
          name: preset.name,
          isInclusive: preset.isInclusive,
          rates: { create: preset.rates },
        },
      });
      created.push(preset.name);
    }

    const groups = await this.list(orgId);
    return { created, groups };
  }
}

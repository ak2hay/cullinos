import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** Legacy shifts also logged the opening float as a cash_in movement; count the float once. */
const LEGACY_OPENING_FLOAT_REASON = "Opening float";

export function expectedDrawerCash(
  openingCash: number,
  movements: Array<{ type: string; amount: unknown; reason?: string | null }>,
): number {
  const sum = (types: string[]) =>
    movements
      .filter(
        (m) =>
          types.includes(m.type) &&
          !(m.type === "cash_in" && m.reason === LEGACY_OPENING_FLOAT_REASON),
      )
      .reduce((s, m) => s + Number(m.amount), 0);
  return Math.round((openingCash + sum(["sale", "cash_in"]) - sum(["cash_out", "drop"])) * 100) / 100;
}

@Injectable()
export class PosShiftsService {
  constructor(private prisma: PrismaService) {}

  private async assertOutlet(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return outlet;
  }

  async getOpenShift(orgId: string, outletId: string, userId?: string) {
    await this.assertOutlet(orgId, outletId);
    return this.prisma.cashierShift.findFirst({
      where: {
        outletId,
        status: "open",
        ...(userId ? { userId } : {}),
      },
      include: { cashMovements: { orderBy: { createdAt: "desc" }, take: 50 } },
      orderBy: { openedAt: "desc" },
    });
  }

  async openShift(
    orgId: string,
    userId: string,
    outletId: string,
    openingCash = 0,
  ) {
    await this.assertOutlet(orgId, outletId);
    const existing = await this.prisma.cashierShift.findFirst({
      where: { outletId, userId, status: "open" },
    });
    if (existing) {
      throw new BadRequestException("You already have an open shift at this outlet");
    }

    return this.prisma.cashierShift.create({
      data: {
        outletId,
        userId,
        status: "open",
        openingCash: Math.max(0, Number(openingCash) || 0),
      },
      include: { cashMovements: true },
    });
  }

  async closeShift(
    orgId: string,
    userId: string,
    shiftId: string,
    closingCash?: number,
  ) {
    const shift = await this.prisma.cashierShift.findFirst({
      where: { id: shiftId, userId, status: "open", outlet: { organizationId: orgId } },
      include: { cashMovements: true },
    });
    if (!shift) throw new NotFoundException("Open shift not found");

    const expected = expectedDrawerCash(Number(shift.openingCash), shift.cashMovements);

    const closing =
      closingCash != null && Number.isFinite(closingCash)
        ? Number(closingCash)
        : expected;

    return this.prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: "closed",
        closingCash: closing,
        closedAt: new Date(),
      },
      include: { cashMovements: true },
    });
  }

  async addMovement(
    orgId: string,
    userId: string,
    shiftId: string,
    input: { type: string; amount: number; reason?: string },
  ) {
    const shift = await this.prisma.cashierShift.findFirst({
      where: { id: shiftId, userId, status: "open", outlet: { organizationId: orgId } },
    });
    if (!shift) throw new NotFoundException("Open shift not found");
    if (!input.type?.trim()) throw new BadRequestException("type is required");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException("amount must be positive");
    }

    return this.prisma.cashMovement.create({
      data: {
        shiftId: shift.id,
        type: input.type.trim(),
        amount: input.amount,
        reason: input.reason?.trim() || null,
      },
    });
  }

  async recordCashSale(orgId: string, outletId: string, userId: string, amount: number) {
    const shift = await this.prisma.cashierShift.findFirst({
      where: { outletId, userId, status: "open" },
    });
    if (!shift) return null;
    return this.prisma.cashMovement.create({
      data: {
        shiftId: shift.id,
        type: "sale",
        amount,
        reason: "POS cash sale",
      },
    });
  }
}

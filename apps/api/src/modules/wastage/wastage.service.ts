import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WastageService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, outletId?: string) {
    return this.prisma.wastage.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
      },
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true } },
      },
      orderBy: { recordedAt: "desc" },
      take: 200,
    });
  }

  async create(
    orgId: string,
    data: {
      inventoryItemId: string;
      quantity: number;
      reason?: string;
      outletId?: string;
    },
  ) {
    const qty = Number(data.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException("quantity must be a positive number");
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: data.inventoryItemId, organizationId: orgId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    if (Number(item.currentStock) < qty) {
      throw new BadRequestException("Insufficient stock");
    }

    const outletId = data.outletId ?? item.outletId ?? null;
    if (data.outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: data.outletId, organizationId: orgId },
      });
      if (!outlet) throw new NotFoundException("Outlet not found");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: { decrement: qty } },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: "wastage",
          quantity: qty,
          notes: data.reason?.trim() || null,
          reference: "wastage",
        },
      });

      return tx.wastage.create({
        data: {
          organizationId: orgId,
          outletId,
          inventoryItemId: item.id,
          quantity: qty,
          reason: data.reason?.trim() || null,
        },
        include: {
          inventoryItem: { select: { id: true, name: true, unit: true } },
        },
      });
    });
  }
}

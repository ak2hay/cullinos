import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }

  listItems(orgId: string) {
    return this.prisma.inventoryItem
      .findMany({
        where: { organizationId: orgId },
        orderBy: { name: "asc" },
        take: 500,
      })
      .then((items) =>
        items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          currentStock: Number(item.currentStock),
        })),
      );
  }

  async transfer(
    orgId: string,
    payload: {
      fromOutletId: string;
      toOutletId: string;
      inventoryItemId: string;
      quantity: number;
      notes?: string;
    },
  ) {
    if (payload.fromOutletId === payload.toOutletId) {
      throw new BadRequestException("Source and destination outlets must differ");
    }

    const [fromOutlet, toOutlet, item] = await Promise.all([
      this.prisma.outlet.findFirst({
        where: { id: payload.fromOutletId, organizationId: orgId },
      }),
      this.prisma.outlet.findFirst({
        where: { id: payload.toOutletId, organizationId: orgId },
      }),
      this.prisma.inventoryItem.findFirst({
        where: { id: payload.inventoryItemId, organizationId: orgId },
      }),
    ]);

    if (!fromOutlet || !toOutlet) throw new NotFoundException("Outlet not found");
    if (!item) throw new NotFoundException("Inventory item not found");
    if (Number(item.currentStock) < payload.quantity) {
      throw new BadRequestException("Insufficient stock at source outlet");
    }

    const reference = `transfer:${payload.fromOutletId}->${payload.toOutletId}`;

    const movement = await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: { decrement: payload.quantity } },
      });

      let destItem = await tx.inventoryItem.findFirst({
        where: {
          organizationId: orgId,
          outletId: payload.toOutletId,
          sku: item.sku,
          name: item.name,
        },
      });

      if (!destItem) {
        destItem = await tx.inventoryItem.create({
          data: {
            organizationId: orgId,
            outletId: payload.toOutletId,
            categoryId: item.categoryId,
            name: item.name,
            sku: item.sku,
            unit: item.unit,
            currentStock: payload.quantity,
            reorderLevel: item.reorderLevel,
            costPerUnit: item.costPerUnit,
          },
        });
      } else {
        await tx.inventoryItem.update({
          where: { id: destItem.id },
          data: { currentStock: { increment: payload.quantity } },
        });
      }

      return tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: "transfer",
          quantity: payload.quantity,
          reference,
          notes: payload.notes,
        },
      });
    });

    return { id: movement.id };
  }
}

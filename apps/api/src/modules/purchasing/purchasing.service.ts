import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { blendUnitCost } from "../../common/recipe-stock.util";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PurchasingService {
  constructor(private prisma: PrismaService) {}

  // ─── Suppliers ─────────────────────────────────────────────────────────────

  listSuppliers(orgId: string) {
    return this.prisma.supplier.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  createSupplier(
    orgId: string,
    data: { name: string; email?: string; phone?: string; address?: string },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Supplier name is required");
    return this.prisma.supplier.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
      },
    });
  }

  async updateSupplier(
    orgId: string,
    id: string,
    data: { name?: string; email?: string; phone?: string; address?: string },
  ) {
    await this.getSupplier(orgId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
      },
    });
  }

  async deleteSupplier(orgId: string, id: string) {
    await this.getSupplier(orgId, id);
    const poCount = await this.prisma.purchaseOrder.count({ where: { supplierId: id } });
    if (poCount > 0) {
      throw new BadRequestException("Cannot delete supplier with existing purchase orders");
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }

  private async getSupplier(orgId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");
    return supplier;
  }

  // ─── Purchase orders ───────────────────────────────────────────────────────

  list(orgId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { supplier: { organizationId: orgId } },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
        grns: { select: { id: true, grnNumber: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async get(orgId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, supplier: { organizationId: orgId } },
      include: {
        supplier: true,
        items: true,
        grns: { include: { items: true } },
      },
    });
    if (!po) throw new NotFoundException("Purchase order not found");
    return po;
  }

  async create(
    orgId: string,
    data: {
      supplierId: string;
      items: Array<{
        inventoryItemId?: string;
        name: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) {
    if (!data.supplierId) throw new BadRequestException("supplierId is required");
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException("At least one line item is required");
    }

    await this.getSupplier(orgId, data.supplierId);

    for (const item of data.items) {
      if (!item.name?.trim()) throw new BadRequestException("Item name is required");
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException("Item quantity must be positive");
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        throw new BadRequestException("Item unit price must be non-negative");
      }
    }

    const total = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const poNumber = await this.nextPoNumber(orgId);

    return this.prisma.purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        poNumber,
        status: "draft",
        total,
        items: {
          create: data.items.map((item) => ({
            inventoryItemId: item.inventoryItemId || null,
            name: item.name.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    });
  }

  async send(orgId: string, id: string) {
    const po = await this.get(orgId, id);
    if (po.status !== "draft") {
      throw new BadRequestException("Only draft purchase orders can be sent");
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: "sent", orderedAt: new Date() },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    });
  }

  async createGrn(
    orgId: string,
    poId: string,
    data: {
      items: Array<{
        inventoryItemId?: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) {
    const po = await this.get(orgId, poId);
    if (po.status === "cancelled") {
      throw new BadRequestException("Cannot receive against a cancelled PO");
    }
    if (!data.items?.length) {
      throw new BadRequestException("At least one GRN line is required");
    }

    const grnNumber = await this.nextGrnNumber(orgId);

    return this.prisma.gRN.create({
      data: {
        purchaseOrderId: po.id,
        grnNumber,
        status: "draft",
        items: {
          create: data.items.map((item) => ({
            inventoryItemId: item.inventoryItemId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });
  }

  async confirmGrn(orgId: string, grnId: string) {
    const grn = await this.prisma.gRN.findFirst({
      where: {
        id: grnId,
        purchaseOrder: { supplier: { organizationId: orgId } },
      },
      include: {
        items: true,
        purchaseOrder: { include: { items: true } },
      },
    });
    if (!grn) throw new NotFoundException("GRN not found");
    if (grn.status !== "draft") {
      throw new BadRequestException("GRN already confirmed or cancelled");
    }

    const receivedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const line of grn.items) {
        if (!line.inventoryItemId) continue;
        const qty = Number(line.quantity);
        const unitCost = Number(line.unitPrice);

        const item = await tx.inventoryItem.findUnique({
          where: { id: line.inventoryItemId },
          select: { currentStock: true, costPerUnit: true, expiryDate: true },
        });
        if (!item) continue;

        const blendedCost = blendUnitCost(
          Number(item.currentStock),
          Number(item.costPerUnit),
          qty,
          unitCost,
        );

        const lot = await tx.inventoryLot.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            qtyRemaining: qty,
            unitCost,
            receivedAt,
            expiryDate: item.expiryDate,
            grnItemId: line.id,
          },
        });

        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: {
            currentStock: { increment: qty },
            costPerUnit: blendedCost,
          },
        });
        await tx.stockMovement.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            lotId: lot.id,
            type: "purchase",
            quantity: qty,
            reference: `grn:${grn.id}`,
            notes: `lot:${lot.id}`,
          },
        });
      }

      await tx.gRN.update({
        where: { id: grnId },
        data: { status: "confirmed", receivedAt },
      });

      if (grn.purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: { status: "received" },
        });
      }
    });

    return this.prisma.gRN.findUnique({
      where: { id: grnId },
      include: { items: true, purchaseOrder: true },
    });
  }

  private async nextPoNumber(orgId: string): Promise<string> {
    const count = await this.prisma.purchaseOrder.count({
      where: { supplier: { organizationId: orgId } },
    });
    return `PO-${String(count + 1).padStart(5, "0")}`;
  }

  private async nextGrnNumber(orgId: string): Promise<string> {
    const count = await this.prisma.gRN.count({
      where: { purchaseOrder: { supplier: { organizationId: orgId } } },
    });
    return `GRN-${String(count + 1).padStart(5, "0")}`;
  }
}

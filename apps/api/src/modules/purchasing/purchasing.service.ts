import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateSupplierInput {
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  outletId: string;
  totalAmount?: number;
  notes?: string;
}

export interface CreateGRNInput {
  purchaseOrderId: string;
  notes?: string;
  receivedItems?: Array<{
    inventoryItemId: string;
    quantity: number;
  }>;
}

export interface CreatePurchaseInvoiceInput {
  supplierId: string;
  invoiceNumber: string;
  amount: number;
  dueDate?: Date;
}

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Suppliers ---

  async findAllSuppliers(organizationId: string) {
    return this.prisma.client.supplier.findMany({
      where: { organizationId, deletedAt: null },
      include: { products: { include: { inventoryItem: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findSupplier(id: string, organizationId: string) {
    const supplier = await this.prisma.client.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { products: { include: { inventoryItem: true } } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async createSupplier(
    organizationId: string,
    userId: string,
    input: CreateSupplierInput,
  ) {
    const supplier = await this.prisma.client.supplier.create({
      data: { organizationId, ...input },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'SUPPLIER_CREATED',
      entityType: 'Supplier',
      entityId: supplier.id,
    });

    return supplier;
  }

  async updateSupplier(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateSupplierInput,
  ) {
    await this.findSupplier(id, organizationId);
    const supplier = await this.prisma.client.supplier.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'SUPPLIER_UPDATED',
      entityType: 'Supplier',
      entityId: id,
    });

    return supplier;
  }

  async deleteSupplier(id: string, organizationId: string, userId: string) {
    await this.findSupplier(id, organizationId);
    await this.prisma.client.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'SUPPLIER_DELETED',
      entityType: 'Supplier',
      entityId: id,
    });

    return { success: true };
  }

  // --- Purchase Orders ---

  private async nextPONumber(outletId: string): Promise<string> {
    const count = await this.prisma.client.purchaseOrder.count({
      where: { outletId },
    });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `PO-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  async findPurchaseOrders(outletId?: string, supplierId?: string) {
    return this.prisma.client.purchaseOrder.findMany({
      where: {
        ...(outletId ? { outletId } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: { supplier: true, grns: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseOrder(
    organizationId: string,
    userId: string,
    input: CreatePurchaseOrderInput,
  ) {
    await this.findSupplier(input.supplierId, organizationId);

    const po = await this.prisma.client.purchaseOrder.create({
      data: {
        supplierId: input.supplierId,
        outletId: input.outletId,
        poNumber: await this.nextPONumber(input.outletId),
        totalAmount: input.totalAmount ?? 0,
        notes: input.notes,
        createdBy: userId,
        status: 'DRAFT',
      },
      include: { supplier: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'PURCHASE_ORDER_CREATED',
      entityType: 'PurchaseOrder',
      entityId: po.id,
    });

    return po;
  }

  async approvePurchaseOrder(
    id: string,
    organizationId: string,
    userId: string,
  ) {
    const po = await this.prisma.client.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!po || po.supplier.organizationId !== organizationId) {
      throw new NotFoundException('Purchase order not found');
    }
    if (po.status !== 'DRAFT') {
      throw new BadRequestException('Only draft POs can be approved');
    }

    const updated = await this.prisma.client.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: po.outletId,
      action: 'PURCHASE_ORDER_APPROVED',
      entityType: 'PurchaseOrder',
      entityId: id,
    });

    return updated;
  }

  // --- GRN ---

  private async nextGRNNumber(): Promise<string> {
    const count = await this.prisma.client.gRN.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `GRN-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  async createGRN(
    organizationId: string,
    userId: string,
    input: CreateGRNInput,
  ) {
    const po = await this.prisma.client.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      include: { supplier: true },
    });
    if (!po || po.supplier.organizationId !== organizationId) {
      throw new NotFoundException('Purchase order not found');
    }
    if (po.status !== 'APPROVED' && po.status !== 'PARTIAL') {
      throw new BadRequestException('PO must be approved before GRN');
    }

    const grn = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.gRN.create({
        data: {
          purchaseOrderId: input.purchaseOrderId,
          grnNumber: await this.nextGRNNumber(),
          notes: input.notes,
          receivedBy: userId,
        },
      });

      if (input.receivedItems?.length) {
        for (const item of input.receivedItems) {
          const stock = await tx.stock.findFirst({
            where: {
              outletId: po.outletId,
              inventoryItemId: item.inventoryItemId,
              batchNumber: null,
            },
          });

          if (stock) {
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity + item.quantity },
            });
          } else {
            await tx.stock.create({
              data: {
                outletId: po.outletId,
                inventoryItemId: item.inventoryItemId,
                quantity: item.quantity,
              },
            });
          }

          await tx.stockMovement.create({
            data: {
              inventoryItemId: item.inventoryItemId,
              outletId: po.outletId,
              type: 'GRN',
              quantity: item.quantity,
              referenceType: 'GRN',
              referenceId: created.id,
              createdBy: userId,
            },
          });
        }
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'RECEIVED' },
      });

      return created;
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: po.outletId,
      action: 'GRN_CREATED',
      entityType: 'GRN',
      entityId: grn.id,
    });

    return grn;
  }

  // --- Purchase Invoices ---

  async findPurchaseInvoices(supplierId?: string) {
    return this.prisma.client.purchaseInvoice.findMany({
      where: supplierId ? { supplierId } : {},
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseInvoice(
    organizationId: string,
    userId: string,
    input: CreatePurchaseInvoiceInput,
  ) {
    await this.findSupplier(input.supplierId, organizationId);

    const invoice = await this.prisma.client.purchaseInvoice.create({
      data: {
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber,
        amount: input.amount,
        dueDate: input.dueDate,
        status: 'PENDING',
      },
      include: { supplier: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'PURCHASE_INVOICE_CREATED',
      entityType: 'PurchaseInvoice',
      entityId: invoice.id,
    });

    return invoice;
  }

  async markPurchaseInvoicePaid(
    id: string,
    organizationId: string,
    userId: string,
  ) {
    const invoice = await this.prisma.client.purchaseInvoice.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!invoice || invoice.supplier.organizationId !== organizationId) {
      throw new NotFoundException('Purchase invoice not found');
    }

    const updated = await this.prisma.client.purchaseInvoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'PURCHASE_INVOICE_PAID',
      entityType: 'PurchaseInvoice',
      entityId: id,
    });

    return updated;
  }
}

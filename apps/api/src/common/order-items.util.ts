import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toPaise } from "./money.util";

export type IncomingOrderItem = {
  menuItemId?: string;
  variantId?: string;
  quantity: number;
  modifiers?: Array<{ name: string; price: number; modifierId?: string }>;
  notes?: string;
  name?: string;
  unitPrice?: number;
};

export type ResolvedOrderItem = {
  menuItemId: string | null;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  modifiers: Array<{ name: string; price: number; modifierId?: string }> | null;
};

export async function resolveOrderItems(
  prisma: PrismaService,
  orgId: string,
  outletId: string,
  items: IncomingOrderItem[],
): Promise<ResolvedOrderItem[]> {
  if (!items?.length) {
    throw new BadRequestException("Order must include at least one item");
  }

  const resolved: ResolvedOrderItem[] = [];

  for (const item of items) {
    if (!item.menuItemId) {
      if (!item.name || item.unitPrice == null) {
        throw new BadRequestException("Each item requires menuItemId or name + unitPrice");
      }
      resolved.push({
        menuItemId: null,
        variantId: null,
        name: item.name,
        quantity: item.quantity,
        unitPrice: toRupeesFromClient(item.unitPrice),
        notes: item.notes ?? null,
        modifiers: item.modifiers ?? null,
      });
      continue;
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: item.menuItemId, organizationId: orgId, isActive: true },
      include: {
        variants: true,
        outletPrices: { where: { outletId, priceType: "retail" } },
      },
    });

    if (!menuItem) {
      throw new BadRequestException(`Menu item not found: ${item.menuItemId}`);
    }

    const outletPrice = menuItem.outletPrices[0];
    let unitPriceRupees = Number(menuItem.basePrice);
    let variantId: string | null = null;
    let name = menuItem.name;

    if (item.variantId) {
      const variant = menuItem.variants.find((v) => v.id === item.variantId);
      if (!variant) {
        throw new BadRequestException(`Variant not found: ${item.variantId}`);
      }
      unitPriceRupees = Number(variant.price);
      variantId = variant.id;
      name = `${menuItem.name} (${variant.name})`;
    } else if (outletPrice) {
      unitPriceRupees = Number(outletPrice.price);
    }

    const modifierTotalPaise =
      item.modifiers?.reduce((sum, m) => sum + (m.price ?? 0), 0) ?? 0;

    resolved.push({
      menuItemId: menuItem.id,
      variantId,
      name,
      quantity: item.quantity,
      unitPrice: unitPriceRupees + modifierTotalPaise / 100,
      notes: item.notes ?? null,
      modifiers: item.modifiers ?? null,
    });
  }

  return resolved;
}

function toRupeesFromClient(price: number): number {
  // Client sends paise when values are large integers; small values are rupees.
  return price >= 1000 ? price / 100 : price;
}

export function mapOrderToClient(order: {
  id: string;
  orderNumber: string;
  status: string;
  tableId: string | null;
  outletId: string;
  subtotal: unknown;
  total?: unknown;
  tipAmount?: unknown;
  customerName?: string | null;
  scheduledPickupAt?: Date | null;
  type?: string;
  createdAt?: Date;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: unknown;
    notes: string | null;
  }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status.toUpperCase(),
    tableId: order.tableId,
    outletId: order.outletId,
    type: order.type?.toUpperCase(),
    customerName: order.customerName,
    scheduledPickupAt: order.scheduledPickupAt?.toISOString(),
    subtotal: toPaise(Number(order.subtotal)),
    tipAmount: order.tipAmount != null ? toPaise(Number(order.tipAmount)) : 0,
    total: order.total != null ? toPaise(Number(order.total)) : undefined,
    totalAmount:
      order.total != null ? toPaise(Number(order.total)) : toPaise(Number(order.subtotal)),
    createdAt: order.createdAt?.toISOString(),
    items: order.items?.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: toPaise(Number(item.unitPrice)),
      notes: item.notes,
    })),
  };
}

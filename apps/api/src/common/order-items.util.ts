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
  taxGroupId: string | null;
};

export type ResolveOrderItemsOptions = {
  /** Public storefront orders: menu IDs only, server prices, DB modifier prices. */
  publicOrder?: boolean;
};

export async function resolveOrderItems(
  prisma: PrismaService,
  orgId: string,
  outletId: string,
  items: IncomingOrderItem[],
  options: ResolveOrderItemsOptions = {},
): Promise<ResolvedOrderItem[]> {
  if (!items?.length) {
    throw new BadRequestException("Order must include at least one item");
  }

  const resolved: ResolvedOrderItem[] = [];

  for (const item of items) {
    if (!item.menuItemId) {
      if (options.publicOrder) {
        throw new BadRequestException("Public orders require menuItemId for every item");
      }
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
        taxGroupId: null,
      });
      continue;
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: item.menuItemId, organizationId: orgId, isActive: true },
      include: {
        variants: true,
        outletPrices: { where: { outletId, priceType: "retail" } },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { modifiers: true },
            },
          },
        },
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

    const modifierCatalog = new Map<
      string,
      { id: string; name: string; price: number }
    >();
    for (const link of menuItem.modifierGroups) {
      for (const mod of link.modifierGroup.modifiers) {
        modifierCatalog.set(mod.id, {
          id: mod.id,
          name: mod.name,
          price: Number(mod.price),
        });
      }
    }

    let resolvedModifiers: Array<{ name: string; price: number; modifierId?: string }> | null =
      null;
    let modifierTotalRupees = 0;

    if (item.modifiers?.length) {
      resolvedModifiers = [];
      for (const incoming of item.modifiers) {
        if (options.publicOrder) {
          if (!incoming.modifierId) {
            throw new BadRequestException("Public orders require modifierId for modifiers");
          }
          const catalog = modifierCatalog.get(incoming.modifierId);
          if (!catalog) {
            throw new BadRequestException(`Modifier not found: ${incoming.modifierId}`);
          }
          resolvedModifiers.push({
            name: catalog.name,
            price: toPaise(catalog.price),
            modifierId: catalog.id,
          });
          modifierTotalRupees += catalog.price;
        } else if (incoming.modifierId && modifierCatalog.has(incoming.modifierId)) {
          const catalog = modifierCatalog.get(incoming.modifierId)!;
          resolvedModifiers.push({
            name: catalog.name,
            price: toPaise(catalog.price),
            modifierId: catalog.id,
          });
          modifierTotalRupees += catalog.price;
        } else {
          // Staff POS may still send free-form modifiers with client prices.
          const priceRupees = toRupeesFromClient(incoming.price ?? 0);
          resolvedModifiers.push({
            name: incoming.name,
            price: toPaise(priceRupees),
            modifierId: incoming.modifierId,
          });
          modifierTotalRupees += priceRupees;
        }
      }
    }

    resolved.push({
      menuItemId: menuItem.id,
      variantId,
      name,
      quantity: item.quantity,
      unitPrice: unitPriceRupees + modifierTotalRupees,
      notes: item.notes ?? null,
      modifiers: resolvedModifiers,
      taxGroupId: menuItem.taxGroupId,
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
  pickupCode?: string | null;
  status: string;
  source?: string;
  tableId: string | null;
  outletId: string;
  table?: { id?: string; name?: string | null } | null;
  subtotal: unknown;
  taxTotal?: unknown;
  total?: unknown;
  tipAmount?: unknown;
  discountTotal?: unknown;
  customerName?: string | null;
  notes?: string | null;
  scheduledPickupAt?: Date | null;
  readyAt?: Date | null;
  type?: string;
  createdAt?: Date;
  taxLines?: Array<{
    taxName: string;
    rate: unknown;
    amount: unknown;
  }>;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: unknown;
    taxAmount?: unknown;
    total?: unknown;
    notes: string | null;
    menuItemId?: string | null;
    menuItem?: { hsnCode?: string | null } | null;
  }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    pickupCode: order.pickupCode ?? null,
    status: order.status.toUpperCase(),
    source: order.source?.toUpperCase(),
    tableId: order.tableId,
    tableName: order.table?.name ?? null,
    outletId: order.outletId,
    type: order.type?.toUpperCase(),
    customerName: order.customerName,
    notes: order.notes ?? null,
    scheduledPickupAt: order.scheduledPickupAt?.toISOString(),
    readyAt: order.readyAt?.toISOString() ?? null,
    subtotal: toPaise(Number(order.subtotal)),
    taxTotal: order.taxTotal != null ? toPaise(Number(order.taxTotal)) : 0,
    tipAmount: order.tipAmount != null ? toPaise(Number(order.tipAmount)) : 0,
    discountTotal: order.discountTotal != null ? toPaise(Number(order.discountTotal)) : 0,
    total: order.total != null ? toPaise(Number(order.total)) : undefined,
    totalAmount:
      order.total != null ? toPaise(Number(order.total)) : toPaise(Number(order.subtotal)),
    createdAt: order.createdAt?.toISOString(),
    taxLines: (order.taxLines ?? []).map((t) => ({
      taxName: t.taxName,
      rate: Number(t.rate),
      amount: toPaise(Number(t.amount)),
    })),
    items: order.items?.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: toPaise(Number(item.unitPrice)),
      taxAmount: item.taxAmount != null ? toPaise(Number(item.taxAmount)) : 0,
      lineTotal: item.total != null ? toPaise(Number(item.total)) : undefined,
      notes: item.notes,
      hsnCode: item.menuItem?.hsnCode ?? null,
    })),
  };
}

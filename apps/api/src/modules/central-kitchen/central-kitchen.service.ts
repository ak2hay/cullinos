import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";

@Injectable()
export class CentralKitchenService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
  ) {}

  list(orgId: string) {
    return this.prisma.centralKitchen.findMany({
      where: { organizationId: orgId },
      include: {
        outlet: { select: { id: true, name: true } },
        linkedOutlets: {
          include: { outlet: { select: { id: true, name: true } } },
        },
      },
      take: 50,
    });
  }

  async get(orgId: string, id: string) {
    const ck = await this.prisma.centralKitchen.findFirst({
      where: { id, organizationId: orgId },
      include: {
        outlet: { select: { id: true, name: true } },
        linkedOutlets: {
          include: { outlet: { select: { id: true, name: true } } },
        },
      },
    });
    if (!ck) throw new NotFoundException("Central kitchen not found");
    return ck;
  }

  async create(
    orgId: string,
    data: { outletId: string; name: string; linkedOutletIds?: string[] },
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: data.outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const existing = await this.prisma.centralKitchen.findUnique({
      where: { outletId: data.outletId },
    });
    if (existing) {
      throw new BadRequestException("This outlet is already a central kitchen");
    }

    const linkedIds = [...new Set(data.linkedOutletIds ?? [])].filter(
      (id) => id !== data.outletId,
    );
    if (linkedIds.length) {
      const outlets = await this.prisma.outlet.findMany({
        where: { organizationId: orgId, id: { in: linkedIds } },
      });
      if (outlets.length !== linkedIds.length) {
        throw new NotFoundException("One or more linked outlets not found");
      }
    }

    return this.prisma.centralKitchen.create({
      data: {
        organizationId: orgId,
        outletId: data.outletId,
        name: data.name.trim(),
        linkedOutlets: {
          create: linkedIds.map((outletId) => ({ outletId })),
        },
      },
      include: {
        outlet: { select: { id: true, name: true } },
        linkedOutlets: {
          include: { outlet: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async updateLinks(orgId: string, id: string, linkedOutletIds: string[]) {
    const ck = await this.get(orgId, id);
    const linkedIds = [...new Set(linkedOutletIds)].filter((oid) => oid !== ck.outletId);

    if (linkedIds.length) {
      const outlets = await this.prisma.outlet.findMany({
        where: { organizationId: orgId, id: { in: linkedIds } },
      });
      if (outlets.length !== linkedIds.length) {
        throw new NotFoundException("One or more linked outlets not found");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.centralKitchenOutlet.deleteMany({ where: { centralKitchenId: id } });
      if (linkedIds.length) {
        await tx.centralKitchenOutlet.createMany({
          data: linkedIds.map((outletId) => ({ centralKitchenId: id, outletId })),
        });
      }
    });

    return this.get(orgId, id);
  }

  listIndents(orgId: string, centralKitchenId?: string) {
    return this.prisma.centralKitchenIndent
      .findMany({
        where: {
          organizationId: orgId,
          ...(centralKitchenId ? { centralKitchenId } : {}),
        },
        include: {
          requestingOutlet: {
            select: { id: true, name: true, city: true, zone: true },
          },
          centralKitchen: { select: { id: true, name: true } },
          items: {
            include: {
              inventoryItem: { select: { id: true, name: true, unit: true } },
            },
          },
        },
        take: 200,
      })
      .then((rows) =>
        [...rows].sort((a, b) => {
          const routeA = a.routeCode ?? "";
          const routeB = b.routeCode ?? "";
          if (routeA !== routeB) return routeA.localeCompare(routeB);
          const seqA = a.sequence ?? Number.MAX_SAFE_INTEGER;
          const seqB = b.sequence ?? Number.MAX_SAFE_INTEGER;
          if (seqA !== seqB) return seqA - seqB;
          const cityA = a.requestingOutlet?.city ?? "";
          const cityB = b.requestingOutlet?.city ?? "";
          if (cityA !== cityB) return cityA.localeCompare(cityB);
          const zoneA = a.requestingOutlet?.zone ?? "";
          const zoneB = b.requestingOutlet?.zone ?? "";
          if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
          const nameA = a.requestingOutlet?.name ?? "";
          const nameB = b.requestingOutlet?.name ?? "";
          return nameA.localeCompare(nameB);
        }),
      );
  }

  /** Assign routeCode + sequence to pending indents by outlet city then name. */
  async planRoutes(orgId: string, centralKitchenId?: string) {
    const pending = await this.prisma.centralKitchenIndent.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["pending", "approved"] },
        ...(centralKitchenId ? { centralKitchenId } : {}),
      },
      include: {
        requestingOutlet: {
          select: { id: true, name: true, city: true, zone: true },
        },
      },
    });

    const sorted = [...pending].sort((a, b) => {
      const cityA = a.requestingOutlet?.city ?? "";
      const cityB = b.requestingOutlet?.city ?? "";
      if (cityA !== cityB) return cityA.localeCompare(cityB);
      const zoneA = a.requestingOutlet?.zone ?? "";
      const zoneB = b.requestingOutlet?.zone ?? "";
      if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
      const nameA = a.requestingOutlet?.name ?? "";
      const nameB = b.requestingOutlet?.name ?? "";
      return nameA.localeCompare(nameB);
    });

    const routeCode = `R-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    await this.prisma.$transaction(
      sorted.map((indent, idx) =>
        this.prisma.centralKitchenIndent.update({
          where: { id: indent.id },
          data: { routeCode, sequence: idx + 1 },
        }),
      ),
    );

    return this.listIndents(orgId, centralKitchenId);
  }

  async createIndent(
    orgId: string,
    data: {
      centralKitchenId: string;
      requestingOutletId: string;
      notes?: string;
      items: Array<{ inventoryItemId: string; quantity: number }>;
    },
  ) {
    const ck = await this.get(orgId, data.centralKitchenId);
    if (!data.items?.length) {
      throw new BadRequestException("At least one indent line is required");
    }

    const linked = await this.prisma.centralKitchenOutlet.findFirst({
      where: {
        centralKitchenId: ck.id,
        outletId: data.requestingOutletId,
      },
    });
    const isHub = data.requestingOutletId === ck.outletId;
    if (!linked && !isHub) {
      throw new BadRequestException("Outlet is not linked to this central kitchen");
    }

    for (const line of data.items) {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException("Item quantity must be positive");
      }
    }

    return this.prisma.centralKitchenIndent.create({
      data: {
        organizationId: orgId,
        centralKitchenId: ck.id,
        requestingOutletId: data.requestingOutletId,
        notes: data.notes?.trim() || null,
        items: {
          create: data.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        requestingOutlet: { select: { id: true, name: true } },
        items: {
          include: {
            inventoryItem: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });
  }

  async fulfillIndent(orgId: string, indentId: string) {
    const indent = await this.prisma.centralKitchenIndent.findFirst({
      where: { id: indentId, organizationId: orgId },
      include: {
        centralKitchen: true,
        items: true,
      },
    });
    if (!indent) throw new NotFoundException("Indent not found");
    if (indent.status === "fulfilled") {
      throw new BadRequestException("Indent already fulfilled");
    }
    if (indent.status === "cancelled") {
      throw new BadRequestException("Cannot fulfill a cancelled indent");
    }

    for (const line of indent.items) {
      await this.inventory.transfer(orgId, {
        fromOutletId: indent.centralKitchen.outletId,
        toOutletId: indent.requestingOutletId,
        inventoryItemId: line.inventoryItemId,
        quantity: Number(line.quantity),
        notes: `Central kitchen indent ${indent.id}`,
      });
    }

    return this.prisma.centralKitchenIndent.update({
      where: { id: indentId },
      data: { status: "fulfilled", fulfilledAt: new Date() },
      include: {
        requestingOutlet: { select: { id: true, name: true } },
        items: {
          include: {
            inventoryItem: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });
  }
}

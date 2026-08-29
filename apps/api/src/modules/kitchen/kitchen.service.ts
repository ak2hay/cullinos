import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class KitchenService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.kOT.findMany({
      where: { order: { organizationId: orgId }, status: { in: ["pending", "preparing"] } },
      include: { items: true, order: true },
      take: 200,
    });
  }

  async getOutletDisplay(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const [kitchenOrders, pickupOrders] = await Promise.all([
      this.prisma.kOT.findMany({
        where: {
          order: { outletId },
          status: { in: ["pending", "preparing"] },
        },
        include: {
          items: { include: { orderItem: true } },
          order: { select: { orderNumber: true, customerName: true, type: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      this.prisma.order.findMany({
        where: {
          outletId,
          status: { in: ["confirmed", "preparing", "ready"] },
          type: { in: ["takeaway", "qr", "online"] },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerName: true,
          scheduledPickupAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 30,
      }),
    ]);

    return {
      outletId,
      operatingMode: outlet.operatingMode,
      kitchen: kitchenOrders.map((kot) => ({
        id: kot.id,
        kotNumber: kot.kotNumber,
        status: kot.status,
        orderNumber: kot.order.orderNumber,
        customerName: kot.order.customerName,
        items: kot.items.map((i) => ({
          id: i.id,
          name: i.orderItem.name,
          quantity: i.orderItem.quantity,
          status: i.status,
        })),
        createdAt: kot.createdAt,
      })),
      pickupQueue: pickupOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customerName,
        scheduledPickupAt: o.scheduledPickupAt,
        createdAt: o.createdAt,
      })),
    };
  }
}

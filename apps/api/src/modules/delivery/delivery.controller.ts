import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { DeliveryService } from "./delivery.service";
import { GuestPushService } from "../guest/guest-push.service";
import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryStatus } from "@prisma/client";

@Controller("delivery")
export class DeliveryController {
  constructor(
    private service: DeliveryService,
    private prisma: PrismaService,
    private push: GuestPushService,
  ) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("zones")
  listZones(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post("zones")
  createZone(
    @OrgId() orgId: string,
    @Body()
    body: {
      name: string;
      outletId?: string;
      pincode?: string;
      minOrder?: number;
      fee?: number;
      estimatedMinutes?: number;
    },
  ) {
    return this.service.createZone(orgId, body);
  }

  @Get("zones/:id")
  getZone(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.getZone(orgId, id);
  }

  @Patch("orders/:orderId")
  @RequireModule("delivery")
  async updateDeliveryStatus(
    @OrgId() orgId: string,
    @Param("orderId") orderId: string,
    @Body()
    body: {
      status?: DeliveryStatus;
      driverName?: string;
      driverPhone?: string;
      estimatedAt?: string;
    },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { deliveryOrder: true },
    });
    if (!order?.deliveryOrder) {
      throw new NotFoundException("Delivery order not found");
    }
    if (!body.status) {
      throw new BadRequestException("status is required");
    }

    const updated = await this.prisma.deliveryOrder.update({
      where: { orderId },
      data: {
        status: body.status,
        driverName: body.driverName?.trim(),
        driverPhone: body.driverPhone?.trim(),
        estimatedAt: body.estimatedAt ? new Date(body.estimatedAt) : undefined,
        deliveredAt: body.status === "delivered" ? new Date() : undefined,
      },
    });

    await this.push.notifyCustomerOrder(order.customerId, {
      title: "Delivery update",
      body: `Order #${order.orderNumber}: ${body.status.replace(/_/g, " ")}`,
      data: {
        orderId: order.id,
        type: "delivery.status",
        status: body.status,
      },
    });

    return updated;
  }
}

@Controller("public/delivery")
export class PublicDeliveryController {
  constructor(private service: DeliveryService) {}

  @Public()
  @Post("quote")
  quote(
    @Body()
    body: {
      outletId?: string;
      address?: string;
      pincode?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.service.quote(body);
  }
}

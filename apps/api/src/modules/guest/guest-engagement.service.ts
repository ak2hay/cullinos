import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GuestEngagementService {
  constructor(private prisma: PrismaService) {}

  async listFavoriteOutlets(guestUserId: string) {
    const rows = await this.prisma.guestFavoriteOutlet.findMany({
      where: { guestUserId },
      include: {
        outlet: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      outletId: r.outletId,
      createdAt: r.createdAt,
      outlet: {
        id: r.outlet.id,
        name: r.outlet.name,
        slug: r.outlet.slug,
        coverImageUrl: r.outlet.coverImageUrl,
        city: r.outlet.city,
        cuisineTags: r.outlet.cuisineTags,
        organization: r.outlet.organization,
      },
    }));
  }

  async addFavoriteOutlet(guestUserId: string, outletId?: string) {
    if (!outletId) throw new BadRequestException("outletId is required");
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, status: "active" },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    const row = await this.prisma.guestFavoriteOutlet.upsert({
      where: {
        guestUserId_outletId: { guestUserId, outletId },
      },
      create: { guestUserId, outletId },
      update: {},
    });
    return { id: row.id, outletId: row.outletId };
  }

  async removeFavoriteOutlet(guestUserId: string, outletId: string) {
    await this.prisma.guestFavoriteOutlet.deleteMany({
      where: { guestUserId, outletId },
    });
    return { success: true };
  }

  async listFavoriteItems(guestUserId: string) {
    const rows = await this.prisma.guestFavoriteItem.findMany({
      where: { guestUserId },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            basePrice: true,
            isVeg: true,
            organizationId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      menuItemId: r.menuItemId,
      organizationId: r.organizationId,
      createdAt: r.createdAt,
      menuItem: {
        ...r.menuItem,
        basePrice: Number(r.menuItem.basePrice),
      },
    }));
  }

  async addFavoriteItem(
    guestUserId: string,
    body: { menuItemId?: string; organizationId?: string },
  ) {
    if (!body.menuItemId) throw new BadRequestException("menuItemId is required");
    const item = await this.prisma.menuItem.findFirst({
      where: { id: body.menuItemId, isActive: true },
    });
    if (!item) throw new NotFoundException("Menu item not found");
    const orgId = body.organizationId || item.organizationId;
    const row = await this.prisma.guestFavoriteItem.upsert({
      where: {
        guestUserId_menuItemId: {
          guestUserId,
          menuItemId: body.menuItemId,
        },
      },
      create: {
        guestUserId,
        menuItemId: body.menuItemId,
        organizationId: orgId,
      },
      update: {},
    });
    return { id: row.id, menuItemId: row.menuItemId };
  }

  async removeFavoriteItem(guestUserId: string, menuItemId: string) {
    await this.prisma.guestFavoriteItem.deleteMany({
      where: { guestUserId, menuItemId },
    });
    return { success: true };
  }

  async createReview(
    guestUserId: string,
    body: {
      outletId?: string;
      orderId?: string;
      rating?: number;
      comment?: string;
    },
  ) {
    const rating = Number(body.rating);
    if (!body.outletId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException("outletId and rating 1-5 are required");
    }
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: body.outletId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    if (body.orderId) {
      const existing = await this.prisma.guestOutletReview.findUnique({
        where: { orderId: body.orderId },
      });
      if (existing) {
        return this.prisma.guestOutletReview.update({
          where: { id: existing.id },
          data: {
            rating: Math.round(rating),
            comment: body.comment?.trim() || null,
          },
        });
      }
    }

    return this.prisma.guestOutletReview.create({
      data: {
        guestUserId,
        outletId: body.outletId,
        orderId: body.orderId || null,
        rating: Math.round(rating),
        comment: body.comment?.trim() || null,
      },
    });
  }

  async listOutletReviews(outletId: string, limit = 30) {
    const rows = await this.prisma.guestOutletReview.findMany({
      where: { outletId, status: "visible" },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      include: {
        guestUser: { select: { name: true } },
      },
    });
    const avg =
      rows.length === 0
        ? null
        : rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    return {
      averageRating: avg != null ? Math.round(avg * 10) / 10 : null,
      count: rows.length,
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        guestName: r.guestUser.name || "Guest",
      })),
    };
  }

  async myReviews(guestUserId: string) {
    return this.prisma.guestOutletReview.findMany({
      where: { guestUserId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: { select: { slug: true, name: true } },
          },
        },
      },
    });
  }

  async listNotifications(guestUserId: string, limit = 50) {
    return this.prisma.guestNotification.findMany({
      where: { guestUserId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });
  }

  async markNotificationRead(guestUserId: string, id: string) {
    const row = await this.prisma.guestNotification.findFirst({
      where: { id, guestUserId },
    });
    if (!row) throw new NotFoundException("Notification not found");
    return this.prisma.guestNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllNotificationsRead(guestUserId: string) {
    await this.prisma.guestNotification.updateMany({
      where: { guestUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async getNotificationPrefs(guestUserId: string) {
    return this.prisma.guestNotificationPreference.upsert({
      where: { guestUserId },
      create: { guestUserId },
      update: {},
    });
  }

  async patchNotificationPrefs(
    guestUserId: string,
    body: { transactionalEnabled?: boolean; marketingEnabled?: boolean },
  ) {
    return this.prisma.guestNotificationPreference.upsert({
      where: { guestUserId },
      create: {
        guestUserId,
        transactionalEnabled: body.transactionalEnabled ?? true,
        marketingEnabled: body.marketingEnabled ?? true,
      },
      update: {
        ...(body.transactionalEnabled != null
          ? { transactionalEnabled: body.transactionalEnabled }
          : {}),
        ...(body.marketingEnabled != null
          ? { marketingEnabled: body.marketingEnabled }
          : {}),
      },
    });
  }

  async createInboxNotification(
    guestUserId: string,
    payload: {
      title: string;
      body: string;
      type?: string;
      data?: Record<string, string>;
    },
  ) {
    return this.prisma.guestNotification.create({
      data: {
        guestUserId,
        title: payload.title,
        body: payload.body,
        type: payload.type || "general",
        data: (payload.data ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

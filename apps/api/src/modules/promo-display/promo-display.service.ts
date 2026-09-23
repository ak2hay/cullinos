import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketingUploadService } from "../marketing/marketing-upload.service";
import { StorefrontService } from "../storefront/storefront.service";

export type SlideInput = {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  slideType?: string;
  sortOrder?: number;
  durationSeconds?: number;
  isActive?: boolean;
};

@Injectable()
export class PromoDisplayService {
  constructor(
    private prisma: PrismaService,
    private storefront: StorefrontService,
    private upload: MarketingUploadService,
  ) {}

  list(orgId: string, outletId: string) {
    return this.prisma.promoDisplaySlide.findMany({
      where: { organizationId: orgId, outletId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 100,
    });
  }

  async create(
    orgId: string,
    outletId: string,
    body: SlideInput,
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return this.prisma.promoDisplaySlide.create({
      data: {
        organizationId: orgId,
        outletId,
        title: body.title?.trim() || null,
        subtitle: body.subtitle?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        slideType: body.slideType?.trim() || "offer",
        sortOrder: body.sortOrder ?? 0,
        durationSeconds: body.durationSeconds ?? 10,
        isActive: body.isActive ?? true,
      },
    });
  }

  async update(orgId: string, id: string, body: SlideInput) {
    const slide = await this.prisma.promoDisplaySlide.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!slide) throw new NotFoundException("Slide not found");
    if (
      body.imageUrl !== undefined &&
      body.imageUrl?.trim() !== (slide.imageUrl ?? "")
    ) {
      await this.upload.deleteManagedUrl(slide.imageUrl);
    }
    return this.prisma.promoDisplaySlide.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
        ...(body.subtitle !== undefined
          ? { subtitle: body.subtitle?.trim() || null }
          : {}),
        ...(body.imageUrl !== undefined
          ? { imageUrl: body.imageUrl?.trim() || null }
          : {}),
        ...(body.slideType !== undefined
          ? { slideType: body.slideType?.trim() || "offer" }
          : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.durationSeconds !== undefined
          ? { durationSeconds: body.durationSeconds }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
  }

  async remove(orgId: string, id: string) {
    const slide = await this.prisma.promoDisplaySlide.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!slide) throw new NotFoundException("Slide not found");
    await this.upload.deleteManagedUrl(slide.imageUrl);
    await this.prisma.promoDisplaySlide.delete({ where: { id } });
    return { success: true, id };
  }

  /**
   * Lightweight public heartbeat for pickup / CDS / playlist displays (no auth).
   * Upserts a virtual Device row and stamps lastSeenAt so the admin hub can
   * show which screens are live.
   */
  async publicHeartbeat(orgSlug: string, outletSlug: string, mode: string) {
    const { outlet } = await this.storefront.resolveActiveOutlet(orgSlug, outletSlug);
    const name = `__display:${(mode || "cds").toLowerCase().replace(/[^a-z]/g, "")}__`;
    const existing = await this.prisma.device.findFirst({
      where: { organizationId: outlet.organizationId, outletId: outlet.id, name },
    });
    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      await this.prisma.device.create({
        data: {
          organizationId: outlet.organizationId,
          outletId: outlet.id,
          name,
          type: "kds",
          lastSeenAt: new Date(),
        },
      });
    }
    return { ok: true };
  }

  async publicPlaylist(orgSlug: string, outletSlug: string) {
    const { outlet } = await this.storefront.resolveActiveOutlet(
      orgSlug,
      outletSlug,
    );
    const slides = await this.prisma.promoDisplaySlide.findMany({
      where: { outletId: outlet.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        slideType: true,
        durationSeconds: true,
        sortOrder: true,
      },
    });
    return {
      outletId: outlet.id,
      outletName: outlet.name,
      slides,
      refreshSeconds: 60,
    };
  }
}

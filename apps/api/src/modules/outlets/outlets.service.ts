import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isGuestThemePresetKey,
  type GuestThemePresetKey,
} from "@cullinos/shared";
import {
  hasConfiguredOpeningHours,
  normalizeOpeningHours,
} from "../../common/opening-hours.util";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketingUploadService } from "../marketing/marketing-upload.service";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function settingsRecord(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }
  return { ...(settings as Record<string, unknown>) };
}

function openingHoursFromSettings(settings: unknown): unknown {
  return settingsRecord(settings).openingHours ?? null;
}

function themeFieldsFromSettings(settings: unknown): {
  guestThemeKey: GuestThemePresetKey | null;
  primaryColor: string | null;
  accentColor: string | null;
} {
  const s = settingsRecord(settings);
  const key = typeof s.guestThemeKey === "string" ? s.guestThemeKey : null;
  return {
    guestThemeKey: isGuestThemePresetKey(key) ? key : null,
    primaryColor:
      typeof s.primaryColor === "string" && s.primaryColor.trim()
        ? s.primaryColor.trim()
        : null,
    accentColor:
      typeof s.accentColor === "string" && s.accentColor.trim()
        ? s.accentColor.trim()
        : null,
  };
}

@Injectable()
export class OutletsService {
  constructor(
    private prisma: PrismaService,
    private upload: MarketingUploadService,
  ) {}

  list(orgId: string, brandId?: string) {
    return this.prisma.outlet
      .findMany({
        where: {
          organizationId: orgId,
          ...(brandId ? { brandId } : {}),
        },
        include: { settings: true },
        orderBy: { name: "asc" },
        take: 200,
      })
      .then((outlets) =>
        outlets.map((outlet) => ({
          id: outlet.id,
          name: outlet.name,
          slug: outlet.slug,
          code: outlet.code,
          city: outlet.city,
          state: outlet.state,
          address: outlet.address,
          pincode: outlet.pincode,
          phone: outlet.phone,
          gstin: outlet.gstin,
          brandId: outlet.brandId,
          operatingMode: outlet.operatingMode,
          isActive: outlet.status === "active",
          latitude: outlet.latitude != null ? Number(outlet.latitude) : null,
          longitude: outlet.longitude != null ? Number(outlet.longitude) : null,
          cuisineTags: outlet.cuisineTags,
          coverImageUrl: outlet.coverImageUrl,
          marketplaceListed: outlet.marketplaceListed,
          averagePrepMinutes: outlet.averagePrepMinutes,
          openingHours: openingHoursFromSettings(outlet.settings?.settings),
          ...themeFieldsFromSettings(outlet.settings?.settings),
        })),
      );
  }

  async create(
    orgId: string,
    data: {
      name: string;
      city?: string;
      phone?: string;
      gstin?: string;
      operatingMode?: string;
    },
  ) {
    // Find the default brand for this org
    const brand = await this.prisma.brand.findFirst({
      where: { organizationId: orgId, isDefault: true },
    });
    if (!brand) {
      // fallback to any brand
      const anyBrand = await this.prisma.brand.findFirst({
        where: { organizationId: orgId },
      });
      if (!anyBrand) throw new NotFoundException("No brand found for organisation");
    }
    const brandId = (brand ?? (await this.prisma.brand.findFirst({ where: { organizationId: orgId } })))!.id;

    const baseSlug = slugify(data.name);
    // Ensure slug is unique within org
    let slug = baseSlug;
    let attempt = 0;
    while (await this.prisma.outlet.findFirst({ where: { organizationId: orgId, slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const outlet = await this.prisma.outlet.create({
      data: {
        organizationId: orgId,
        brandId,
        name: data.name,
        slug,
        city: data.city,
        phone: data.phone,
        gstin: data.gstin?.trim() || null,
        operatingMode: (data.operatingMode as never) ?? "full_service",
        settings: { create: { settings: {} } },
      },
    });

    return {
      id: outlet.id,
      name: outlet.name,
      slug: outlet.slug,
      city: outlet.city,
      phone: outlet.phone,
      gstin: outlet.gstin,
      operatingMode: outlet.operatingMode,
      isActive: outlet.status === "active",
    };
  }

  async update(orgId: string, id: string, data: Record<string, unknown>) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id, organizationId: orgId },
      include: { settings: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const allowed: Record<string, unknown> = {};
    if (data.operatingMode) allowed.operatingMode = data.operatingMode;
    if (data.name) allowed.name = data.name;
    if (data.phone !== undefined) allowed.phone = data.phone;
    if (data.gstin !== undefined) {
      allowed.gstin =
        data.gstin === null || data.gstin === ""
          ? null
          : String(data.gstin).trim();
    }
    if (data.address !== undefined) allowed.address = data.address;
    if (data.city !== undefined) allowed.city = data.city;
    if (data.state !== undefined) allowed.state = data.state;
    if (data.pincode !== undefined) allowed.pincode = data.pincode;
    if (data.latitude !== undefined) {
      allowed.latitude =
        data.latitude === null || data.latitude === ""
          ? null
          : Number(data.latitude);
    }
    if (data.longitude !== undefined) {
      allowed.longitude =
        data.longitude === null || data.longitude === ""
          ? null
          : Number(data.longitude);
    }
    if (data.coverImageUrl !== undefined) {
      const next =
        data.coverImageUrl === null || data.coverImageUrl === ""
          ? null
          : String(data.coverImageUrl);
      if (next !== outlet.coverImageUrl) {
        await this.upload.deleteManagedUrl(outlet.coverImageUrl);
      }
      allowed.coverImageUrl = next;
    }
    if (data.averagePrepMinutes !== undefined) {
      allowed.averagePrepMinutes =
        data.averagePrepMinutes === null || data.averagePrepMinutes === ""
          ? null
          : Number(data.averagePrepMinutes);
    }
    if (data.cuisineTags !== undefined) {
      const tags = Array.isArray(data.cuisineTags)
        ? data.cuisineTags
        : String(data.cuisineTags)
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
      allowed.cuisineTags = tags;
    }

    const settingsPatch: Record<string, unknown> = {};
    if (data.guestThemeKey !== undefined) {
      const raw =
        data.guestThemeKey === null || data.guestThemeKey === ""
          ? null
          : String(data.guestThemeKey);
      if (raw !== null && !isGuestThemePresetKey(raw)) {
        throw new BadRequestException(
          "guestThemeKey must be one of: classic, forest, ocean, spice, charcoal, sunset",
        );
      }
      settingsPatch.guestThemeKey = raw;
    }
    if (data.primaryColor !== undefined) {
      settingsPatch.primaryColor =
        data.primaryColor === null || data.primaryColor === ""
          ? null
          : String(data.primaryColor).trim();
    }
    if (data.accentColor !== undefined) {
      settingsPatch.accentColor =
        data.accentColor === null || data.accentColor === ""
          ? null
          : String(data.accentColor).trim();
    }
    if (data.openingHours !== undefined) {
      if (data.openingHours === null) {
        settingsPatch.openingHours = null;
      } else {
        const normalized = normalizeOpeningHours(data.openingHours);
        if (normalized == null) {
          throw new BadRequestException(
            "openingHours must include at least one day with open/close times.",
          );
        }
        settingsPatch.openingHours = normalized;
      }
    }

    const nextLat =
      allowed.latitude !== undefined
        ? (allowed.latitude as number | null)
        : outlet.latitude != null
          ? Number(outlet.latitude)
          : null;
    const nextLng =
      allowed.longitude !== undefined
        ? (allowed.longitude as number | null)
        : outlet.longitude != null
          ? Number(outlet.longitude)
          : null;
    const nextOpeningHours =
      settingsPatch.openingHours !== undefined
        ? settingsPatch.openingHours
        : openingHoursFromSettings(outlet.settings?.settings);

    if (data.marketplaceListed !== undefined) {
      const wantListed = Boolean(data.marketplaceListed);
      if (wantListed && outlet.marketplaceUnlistedByPlatform) {
        throw new BadRequestException(
          "This outlet was unlisted by the platform and cannot be re-listed until cleared by Cullinos App Ops.",
        );
      }
      if (wantListed) {
        if (
          nextLat == null ||
          nextLng == null ||
          !Number.isFinite(nextLat) ||
          !Number.isFinite(nextLng)
        ) {
          throw new BadRequestException(
            "Latitude and longitude are required before listing on the marketplace.",
          );
        }
        if (!hasConfiguredOpeningHours(nextOpeningHours)) {
          throw new BadRequestException(
            "Opening hours are required before listing on the marketplace.",
          );
        }
      }
      allowed.marketplaceListed = wantListed;
    }

    const updated = await this.prisma.outlet.update({
      where: { id },
      data: allowed as never,
      include: { settings: true },
    });

    if (Object.keys(settingsPatch).length > 0) {
      const merged = {
        ...settingsRecord(updated.settings?.settings),
        ...settingsPatch,
      };
      await this.prisma.outletSettings.upsert({
        where: { outletId: id },
        create: { outletId: id, settings: merged as never },
        update: { settings: merged as never },
      });
    }

    const settingsRow = await this.prisma.outletSettings.findUnique({
      where: { outletId: id },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      city: updated.city,
      address: updated.address,
      pincode: updated.pincode,
      phone: updated.phone,
      operatingMode: updated.operatingMode,
      isActive: updated.status === "active",
      latitude: updated.latitude != null ? Number(updated.latitude) : null,
      longitude: updated.longitude != null ? Number(updated.longitude) : null,
      cuisineTags: updated.cuisineTags,
      coverImageUrl: updated.coverImageUrl,
      marketplaceListed: updated.marketplaceListed,
      averagePrepMinutes: updated.averagePrepMinutes,
      openingHours: openingHoursFromSettings(settingsRow?.settings),
      ...themeFieldsFromSettings(settingsRow?.settings),
    };
  }

  async listPhotos(orgId: string, outletId: string) {
    await this.assertOutlet(orgId, outletId);
    const photos = await this.prisma.outletPhoto.findMany({
      where: { outletId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return photos.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async addPhoto(
    orgId: string,
    outletId: string,
    data: { url: string; caption?: string; setAsCover?: boolean },
  ) {
    await this.assertOutlet(orgId, outletId);
    const url = data.url?.trim();
    if (!url) throw new BadRequestException("Photo URL is required");

    const count = await this.prisma.outletPhoto.count({ where: { outletId } });
    if (count >= 8) {
      throw new BadRequestException("Maximum 8 restaurant photos per outlet");
    }

    const photo = await this.prisma.outletPhoto.create({
      data: {
        outletId,
        url,
        caption: data.caption?.trim() || null,
        sortOrder: count,
      },
    });

    if (data.setAsCover || count === 0) {
      await this.prisma.outlet.update({
        where: { id: outletId },
        data: { coverImageUrl: url },
      });
    }

    return {
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      sortOrder: photo.sortOrder,
      createdAt: photo.createdAt.toISOString(),
    };
  }

  async reorderPhotos(orgId: string, outletId: string, photoIds: string[]) {
    await this.assertOutlet(orgId, outletId);
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      throw new BadRequestException("photoIds are required");
    }
    const existing = await this.prisma.outletPhoto.findMany({
      where: { outletId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((p) => p.id));
    if (photoIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException("One or more photos do not belong to this outlet");
    }
    await this.prisma.$transaction(
      photoIds.map((id, idx) =>
        this.prisma.outletPhoto.update({
          where: { id },
          data: { sortOrder: idx },
        }),
      ),
    );
    return this.listPhotos(orgId, outletId);
  }

  async deletePhoto(orgId: string, outletId: string, photoId: string) {
    await this.assertOutlet(orgId, outletId);
    const photo = await this.prisma.outletPhoto.findFirst({
      where: { id: photoId, outletId },
    });
    if (!photo) throw new NotFoundException("Photo not found");
    await this.upload.deleteManagedUrl(photo.url);
    await this.prisma.outletPhoto.delete({ where: { id: photoId } });

    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (outlet?.coverImageUrl === photo.url) {
      const next = await this.prisma.outletPhoto.findFirst({
        where: { outletId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      await this.prisma.outlet.update({
        where: { id: outletId },
        data: { coverImageUrl: next?.url ?? null },
      });
    }
    return { success: true };
  }

  async setCoverFromPhoto(orgId: string, outletId: string, photoId: string) {
    await this.assertOutlet(orgId, outletId);
    const photo = await this.prisma.outletPhoto.findFirst({
      where: { id: photoId, outletId },
    });
    if (!photo) throw new NotFoundException("Photo not found");
    await this.prisma.outlet.update({
      where: { id: outletId },
      data: { coverImageUrl: photo.url },
    });
    return { coverImageUrl: photo.url };
  }

  async photoUrlsForOutlet(outletId: string): Promise<string[]> {
    const photos = await this.prisma.outletPhoto.findMany({
      where: { outletId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { url: true },
    });
    return photos.map((p) => p.url);
  }

  private async assertOutlet(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
      select: { id: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return outlet;
  }
}

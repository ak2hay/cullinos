import {
  BadRequestException,
  Injectable,
  Optional,
  PayloadTooLargeException,
} from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import type { Request } from "express";
import sharp from "sharp";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { resolveMarketingPublicBaseUrl } from "../../common/public-asset-url.util";

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** Platform-wide max for image uploads (multer ceiling; super admins). */
export const MARKETING_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
/** Max for tenant (restaurant) accounts. Super admins and impersonation sessions are exempt. */
export const TENANT_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const MAX_BYTES = MARKETING_UPLOAD_MAX_BYTES;

export type UploadActor =
  | { isSuperAdmin?: boolean | null; impersonatedBy?: string | null }
  | null
  | undefined;

/** Byte limit for the authenticated uploader. */
export function uploadMaxBytesFor(actor: UploadActor): number {
  if (actor?.isSuperAdmin || actor?.impersonatedBy) return MARKETING_UPLOAD_MAX_BYTES;
  return TENANT_UPLOAD_MAX_BYTES;
}
/** Reject camera dumps larger than this on the longest side. */
export const MARKETING_UPLOAD_MAX_PIXELS = 4096;
export const MARKETING_PREFIX = "marketing";

export type ImageSlot =
  | "banner"
  | "promoSlide"
  | "coupon"
  | "menuItem"
  | "outletCover"
  | "outletGallery"
  | "notification"
  | "orgLogo"
  | "avatar";

export type ImageSlotSpec = {
  slot: ImageSlot;
  label: string;
  /** width / height — recommended ratio for UI hints only */
  ratio: number;
  targetWidth: number;
  targetHeight: number;
  maxBytes: number;
};

export const IMAGE_SLOT_SPECS: Record<ImageSlot, ImageSlotSpec> = {
  banner: {
    slot: "banner",
    label: "Guest banner",
    ratio: 3 / 1,
    targetWidth: 1200,
    targetHeight: 400,
    maxBytes: MAX_BYTES,
  },
  promoSlide: {
    slot: "promoSlide",
    label: "Promo playlist slide",
    ratio: 16 / 9,
    targetWidth: 1920,
    targetHeight: 1080,
    maxBytes: MAX_BYTES,
  },
  coupon: {
    slot: "coupon",
    label: "Coupon / offer",
    ratio: 1,
    targetWidth: 800,
    targetHeight: 800,
    maxBytes: MAX_BYTES,
  },
  menuItem: {
    slot: "menuItem",
    label: "Menu product",
    ratio: 1,
    targetWidth: 800,
    targetHeight: 800,
    maxBytes: MAX_BYTES,
  },
  outletCover: {
    slot: "outletCover",
    label: "Outlet cover",
    ratio: 16 / 9,
    targetWidth: 1600,
    targetHeight: 900,
    maxBytes: MAX_BYTES,
  },
  outletGallery: {
    slot: "outletGallery",
    label: "Outlet gallery",
    ratio: 4 / 3,
    targetWidth: 1200,
    targetHeight: 900,
    maxBytes: MAX_BYTES,
  },
  notification: {
    slot: "notification",
    label: "Push notification hero",
    ratio: 2 / 1,
    targetWidth: 1200,
    targetHeight: 600,
    maxBytes: MAX_BYTES,
  },
  orgLogo: {
    slot: "orgLogo",
    label: "Organization logo",
    ratio: 1,
    targetWidth: 512,
    targetHeight: 512,
    maxBytes: MAX_BYTES,
  },
  avatar: {
    slot: "avatar",
    label: "Profile photo",
    ratio: 1,
    targetWidth: 512,
    targetHeight: 512,
    maxBytes: MAX_BYTES,
  },
};

/** Path context for hierarchical R2 / local keys under `marketing/`. */
export type UploadPathContext = {
  scope: "org" | "platform";
  /** Required when scope is `org`. */
  orgId?: string;
  outletId?: string;
  /** Entity id used as leaf (menu item id) or ignored when leafName set. */
  entityId?: string;
  /**
   * Stable leaf filename without extension.
   * When omitted, a UUID is used (except outletCover → `cover`).
   */
  leafName?: string;
  /** Platform area: CMS website assets vs guest-ops banners/push. */
  platformArea?: "cms" | "guest-ops" | "avatars";
  imageSlot?: ImageSlot;
};

/** Sniff image MIME from magic bytes (PNG / JPEG / WebP only). */
export function sniffImageMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Multer fileFilter: reject by declared MIME + extension before buffering completes.
 * Magic-byte check still runs in validateFile after upload.
 */
export function marketingImageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.has(file.mimetype) || (ext && !ALLOWED_EXTENSIONS.has(ext))) {
    cb(
      new BadRequestException("Unsupported file type. Use PNG, JPG, or WebP."),
      false,
    );
    return;
  }
  cb(null, true);
}

/** Sanitize a path segment (ids / leaf names) — alphanumeric, dash, underscore only. */
export function sanitizePathSegment(raw: string, fallback = "x"): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
  return cleaned || fallback;
}

/**
 * Build object key relative to bucket (includes `marketing/` prefix).
 * Also used as relative path under local cms upload dir.
 */
export function buildStorageKey(ctx: UploadPathContext, ext: string): string {
  const safeExt = ALLOWED_EXTENSIONS.has(ext.toLowerCase())
    ? ext.toLowerCase()
    : ".bin";
  const rawLeaf = ctx.leafName ?? ctx.entityId ?? randomUUID();
  const leaf = sanitizePathSegment(rawLeaf, randomUUID()) + safeExt;

  if (ctx.scope === "platform") {
    const area = ctx.platformArea ?? "cms";
    if (area === "guest-ops") {
      const folder =
        ctx.imageSlot === "notification" ? "push" : "banners";
      return `${MARKETING_PREFIX}/platform/guest-ops/${folder}/${leaf}`;
    }
    if (area === "avatars") return `${MARKETING_PREFIX}/platform/avatars/${leaf}`;
    return `${MARKETING_PREFIX}/platform/cms/${leaf}`;
  }

  const orgId = sanitizePathSegment(ctx.orgId ?? "", "");
  if (!orgId) {
    throw new BadRequestException("Organization id is required for org uploads.");
  }

  switch (ctx.imageSlot) {
    case "menuItem":
      return `${MARKETING_PREFIX}/orgs/${orgId}/menu/${leaf}`;
    case "outletCover": {
      const outletId = sanitizePathSegment(ctx.outletId ?? "", "");
      if (!outletId) {
        throw new BadRequestException("Outlet id is required for cover uploads.");
      }
      const coverLeaf = sanitizePathSegment(ctx.leafName ?? "cover", "cover") + safeExt;
      return `${MARKETING_PREFIX}/orgs/${orgId}/outlets/${outletId}/${coverLeaf}`;
    }
    case "outletGallery": {
      const outletId = sanitizePathSegment(ctx.outletId ?? "", "");
      if (!outletId) {
        throw new BadRequestException("Outlet id is required for gallery uploads.");
      }
      return `${MARKETING_PREFIX}/orgs/${orgId}/outlets/${outletId}/gallery/${leaf}`;
    }
    case "coupon":
      return `${MARKETING_PREFIX}/orgs/${orgId}/coupons/${leaf}`;
    case "banner":
      return `${MARKETING_PREFIX}/orgs/${orgId}/banners/${leaf}`;
    case "promoSlide":
      return `${MARKETING_PREFIX}/orgs/${orgId}/promo/${leaf}`;
    case "notification":
      return `${MARKETING_PREFIX}/orgs/${orgId}/push/${leaf}`;
    case "orgLogo":
      return `${MARKETING_PREFIX}/orgs/${orgId}/logo/${leaf}`;
    case "avatar":
      return `${MARKETING_PREFIX}/orgs/${orgId}/avatars/${leaf}`;
    default:
      return `${MARKETING_PREFIX}/orgs/${orgId}/misc/${leaf}`;
  }
}

/** Read width/height from PNG / JPEG / WebP buffers without native deps. */
export function probeImageDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (!buffer || buffer.length < 24) return null;

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      // SOF0 / SOF2
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  // WebP (RIFF....WEBP)
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X" && buffer.length >= 30) {
      const width =
        1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
      const height =
        1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
      return { width, height };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      // Lossy bitstream starts at offset 20; frame tag then width/height at 26
      const start = 20;
      if (buffer.length >= start + 10) {
        const width = buffer.readUInt16LE(start + 6) & 0x3fff;
        const height = buffer.readUInt16LE(start + 8) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      }
    }
    if (chunk === "VP8L" && buffer.length >= 25) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height =
        1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
  }

  return null;
}

function extFromMime(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".bin";
}

function mimeFromExt(ext: string) {
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

const DEFAULT_ORG_STORAGE_QUOTA_MB = 500;

function orgStorageQuotaBytes(): number {
  const mb = Number(process.env.ORG_STORAGE_QUOTA_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_ORG_STORAGE_QUOTA_MB) * 1024 * 1024;
}

/**
 * Decode and re-encode uploads: drops EXIF (GPS, device serials) and any payload hidden
 * after the image data, and applies EXIF orientation before it is stripped.
 */
export async function reencodeImage(buffer: Buffer, mime: string): Promise<Buffer> {
  const image = sharp(buffer, {
    limitInputPixels: MARKETING_UPLOAD_MAX_PIXELS * MARKETING_UPLOAD_MAX_PIXELS,
    failOn: "error",
  }).rotate();
  if (mime === "image/png") return image.png({ compressionLevel: 9 }).toBuffer();
  if (mime === "image/webp") return image.webp({ quality: 85 }).toBuffer();
  return image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

@Injectable()
export class MarketingUploadService {
  private uploadDir: string;
  private publicBaseUrl: string;

  constructor(
    private readonly storage: StorageService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    this.uploadDir =
      process.env.MARKETING_UPLOAD_DIR ||
      path.resolve(process.cwd(), "../web/public/cms");
    this.publicBaseUrl = resolveMarketingPublicBaseUrl();
    if (!this.storage.isCloudEnabled()) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /** Absolute public base for local uploads (no trailing slash). */
  getLocalPublicBaseUrl(): string {
    return this.publicBaseUrl.replace(/\/$/, "");
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  getSlotSpec(slot: ImageSlot): ImageSlotSpec {
    return IMAGE_SLOT_SPECS[slot];
  }

  listSlotSpecs(): ImageSlotSpec[] {
    return Object.values(IMAGE_SLOT_SPECS);
  }

  validateFile(file: Express.Multer.File, maxBytes = MAX_BYTES) {
    if (!file?.buffer) {
      throw new BadRequestException("No file uploaded.");
    }
    const sniffed = sniffImageMime(file.buffer);
    if (!sniffed || !ALLOWED_IMAGE_MIMES.has(sniffed)) {
      throw new BadRequestException(
        "Unsupported file type. Use PNG, JPG, or WebP.",
      );
    }
    // Client MIME must match sniff when present (blocks MIME spoofing).
    if (file.mimetype && !ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        "Unsupported file type. Use PNG, JPG, or WebP.",
      );
    }
    if (file.mimetype && file.mimetype !== sniffed) {
      throw new BadRequestException(
        "File content does not match declared type. Use PNG, JPG, or WebP.",
      );
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024) * 10) / 10}MB.`,
      );
    }
    return sniffed;
  }

  /**
   * Slot validation: magic MIME + size + readable dims + max pixel bound.
   * Recommended aspect ratios are UI hints only — not hard-rejected.
   */
  validateSlot(file: Express.Multer.File, slot: ImageSlot, maxBytes = MAX_BYTES) {
    const spec = IMAGE_SLOT_SPECS[slot];
    this.validateFile(file, Math.min(spec.maxBytes, maxBytes));
    const dims = probeImageDimensions(file.buffer);
    if (!dims || dims.width < 1 || dims.height < 1) {
      throw new BadRequestException(
        "Could not read image dimensions. Use a valid PNG, JPG, or WebP.",
      );
    }
    if (
      dims.width > MARKETING_UPLOAD_MAX_PIXELS ||
      dims.height > MARKETING_UPLOAD_MAX_PIXELS
    ) {
      throw new BadRequestException(
        `${spec.label} is too large. Maximum dimension is ${MARKETING_UPLOAD_MAX_PIXELS}px on the longest side. Got ${dims.width}×${dims.height}.`,
      );
    }
    return { ...dims, spec };
  }

  async saveUploadedFile(
    file: Express.Multer.File,
    pathCtx: UploadPathContext,
    maxBytes = MAX_BYTES,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("No file uploaded.");
    }
    if (pathCtx.imageSlot) {
      this.validateSlot(file, pathCtx.imageSlot, maxBytes);
    } else {
      this.validateFile(file, maxBytes);
    }

    const sniffed = sniffImageMime(file.buffer) ?? "image/jpeg";
    const ext =
      extFromMime(sniffed) ||
      path.extname(file.originalname).toLowerCase() ||
      ".bin";
    const key = buildStorageKey(pathCtx, ext);
    // Relative path under marketing/ for DB filename field (keeps nested structure).
    const relativePath = key.startsWith(`${MARKETING_PREFIX}/`)
      ? key.slice(MARKETING_PREFIX.length + 1)
      : key;

    let body: Buffer;
    try {
      body = await reencodeImage(file.buffer, sniffed);
    } catch {
      throw new BadRequestException("Could not process image. Use a valid PNG, JPG, or WebP.");
    }
    const orgId = pathCtx.scope === "org" ? pathCtx.orgId : undefined;
    if (orgId) await this.assertOrgQuota(orgId, key, body.length);

    let url: string;
    if (this.storage.isCloudEnabled()) {
      const saved = await this.storage.putObject({ key, body, contentType: sniffed });
      url = saved.url;
    } else {
      const base = this.publicBaseUrl.replace(/\/$/, "");
      if (process.env.NODE_ENV === "production" && !/^https?:\/\//i.test(base)) {
        throw new BadRequestException(
          "Image storage is not configured for production. Set R2_* + R2_PUBLIC_URL, or an absolute MARKETING_PUBLIC_URL / API_PUBLIC_URL.",
        );
      }
      const root = path.resolve(this.uploadDir);
      const dest = path.resolve(root, relativePath);
      if (!dest.startsWith(root + path.sep)) {
        throw new BadRequestException("Invalid upload path.");
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, body);
      url = `${base}/${relativePath}`;
    }

    if (orgId && this.prisma) {
      await this.prisma.storedObject.upsert({
        where: { key },
        create: { organizationId: orgId, key, sizeBytes: body.length },
        update: { sizeBytes: body.length },
      });
    }
    return {
      filename: relativePath,
      url,
      mimeType: sniffed,
      sizeBytes: body.length,
    };
  }

  /** Per-org storage cap; replacing an existing object only counts the size difference. */
  private async assertOrgQuota(orgId: string, key: string, newBytes: number) {
    if (!this.prisma) return;
    const [used, existing] = await Promise.all([
      this.prisma.storedObject.aggregate({
        where: { organizationId: orgId },
        _sum: { sizeBytes: true },
      }),
      this.prisma.storedObject.findUnique({ where: { key }, select: { sizeBytes: true } }),
    ]);
    const quota = orgStorageQuotaBytes();
    const projected = (used._sum.sizeBytes ?? 0) - (existing?.sizeBytes ?? 0) + newBytes;
    if (projected > quota) {
      throw new PayloadTooLargeException(
        `Storage limit reached (${Math.round(quota / (1024 * 1024))} MB). Delete unused images and try again.`,
      );
    }
  }

  async copyFromPublicImages(sourceDir: string, slotKey: string, filename: string) {
    const src = path.join(sourceDir, filename);
    if (!fs.existsSync(src)) return null;
    const ext = path.extname(filename);
    const mimeType = mimeFromExt(ext);
    const body = fs.readFileSync(src);
    const key = buildStorageKey(
      {
        scope: "platform",
        platformArea: "cms",
        leafName: slotKey,
      },
      ext || ".png",
    );
    const relativePath = key.startsWith(`${MARKETING_PREFIX}/`)
      ? key.slice(MARKETING_PREFIX.length + 1)
      : key;

    if (this.storage.isCloudEnabled()) {
      const saved = await this.storage.putObject({
        key,
        body,
        contentType: mimeType,
      });
      return {
        filename: relativePath,
        url: saved.url,
        mimeType,
        sizeBytes: body.length,
      };
    }

    const dest = path.join(this.uploadDir, relativePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
    const stat = fs.statSync(dest);
    const base = this.publicBaseUrl.replace(/\/$/, "");
    return {
      filename: relativePath,
      url: `${base}/${relativePath}`,
      mimeType,
      sizeBytes: stat.size,
    };
  }

  /**
   * Delete only URLs we host, and only inside the caller's own storage prefix
   * (`marketing/orgs/<orgId>/` or `marketing/platform/`). No-op for anything else,
   * so a tenant can never delete another tenant's (or platform) objects by URL.
   */
  async deleteManagedUrl(url: string | null | undefined, scope: ManagedUrlScope) {
    if (!url?.trim()) return;
    try {
      const key = this.managedKeyFromUrl(url.trim());
      if (!key || !isKeyInScope(key, scope)) return;
      await this.deleteKey(key);
    } catch {
      // Best-effort cleanup — don't fail the parent delete.
    }
  }

  /** Platform CMS asset delete (super-admin only callers). */
  async deleteByUrl(url: string) {
    await this.deleteManagedUrl(url, "platform");
  }

  private managedKeyFromUrl(url: string): string | null {
    let key: string | null;
    if (this.storage.isCloudEnabled()) {
      key = this.storage.keyFromPublicUrl(url);
    } else {
      const base = this.publicBaseUrl.replace(/\/$/, "");
      let relative: string | null = null;
      if (url.startsWith(base + "/")) {
        relative = url.slice(base.length + 1);
      } else {
        const idx = url.indexOf("/cms/");
        if (idx >= 0) relative = url.slice(idx + "/cms/".length);
      }
      key = relative ? `${MARKETING_PREFIX}/${relative}` : null;
    }
    if (!key || key.includes("..") || key.includes("\\")) return null;
    return key;
  }

  private async deleteKey(key: string) {
    if (this.storage.isCloudEnabled()) {
      await this.storage.deleteObject(key);
    } else {
      const relative = key.slice(MARKETING_PREFIX.length + 1);
      const filePath = path.join(this.uploadDir, relative);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await this.prisma?.storedObject.deleteMany({ where: { key } });
  }
}

export type ManagedUrlScope = { orgId: string } | "platform";

/** Platform scope covers every managed key outside tenant folders (incl. legacy flat CMS files). */
export function isKeyInScope(key: string, scope: ManagedUrlScope): boolean {
  if (!key.startsWith(`${MARKETING_PREFIX}/`)) return false;
  if (scope === "platform") return !key.startsWith(`${MARKETING_PREFIX}/orgs/`);
  const orgId = sanitizePathSegment(scope.orgId ?? "", "");
  if (!orgId || orgId !== scope.orgId) return false;
  return key.startsWith(`${MARKETING_PREFIX}/orgs/${orgId}/`);
}

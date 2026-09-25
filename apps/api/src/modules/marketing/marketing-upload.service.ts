import { BadRequestException, Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { StorageService } from "../storage/storage.service";
import { resolveMarketingPublicBaseUrl } from "../../common/public-asset-url.util";

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

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
const MARKETING_PREFIX = "marketing";

export type ImageSlot =
  | "banner"
  | "promoSlide"
  | "coupon"
  | "menuItem"
  | "outletCover"
  | "outletGallery"
  | "notification";

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
};

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

@Injectable()
export class MarketingUploadService {
  private uploadDir: string;
  private publicBaseUrl: string;

  constructor(private readonly storage: StorageService) {
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
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        "Unsupported file type. Use PNG, JPG, or WebP.",
      );
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024) * 10) / 10}MB.`,
      );
    }
  }

  /**
   * Slot validation: MIME + size + readable dims + max pixel bound.
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
    slotKey?: string,
    imageSlot?: ImageSlot,
    maxBytes = MAX_BYTES,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("No file uploaded.");
    }
    if (imageSlot) {
      this.validateSlot(file, imageSlot, maxBytes);
    } else {
      this.validateFile(file, maxBytes);
    }
    const ext = path.extname(file.originalname) || this.extFromMime(file.mimetype);
    const filename = slotKey ? `${slotKey}${ext}` : `${randomUUID()}${ext}`;

    if (this.storage.isCloudEnabled()) {
      const key = `${MARKETING_PREFIX}/${filename}`;
      const saved = await this.storage.putObject({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      return {
        filename,
        url: saved.url,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      };
    }

    const dest = path.join(this.uploadDir, filename);
    fs.writeFileSync(dest, file.buffer);
    const base = this.publicBaseUrl.replace(/\/$/, "");
    if (
      process.env.NODE_ENV === "production" &&
      !/^https?:\/\//i.test(base)
    ) {
      throw new BadRequestException(
        "Image storage is not configured for production. Set R2_* + R2_PUBLIC_URL, or an absolute MARKETING_PUBLIC_URL / API_PUBLIC_URL.",
      );
    }
    return {
      filename,
      url: `${base}/${filename}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  async copyFromPublicImages(sourceDir: string, slotKey: string, filename: string) {
    const src = path.join(sourceDir, filename);
    if (!fs.existsSync(src)) return null;
    const destName = `${slotKey}${path.extname(filename)}`;
    const mimeType = this.mimeFromExt(path.extname(filename));
    const body = fs.readFileSync(src);

    if (this.storage.isCloudEnabled()) {
      const key = `${MARKETING_PREFIX}/${destName}`;
      const saved = await this.storage.putObject({
        key,
        body,
        contentType: mimeType,
      });
      return {
        filename: destName,
        url: saved.url,
        mimeType,
        sizeBytes: body.length,
      };
    }

    const dest = path.join(this.uploadDir, destName);
    fs.writeFileSync(dest, body);
    const stat = fs.statSync(dest);
    const base = this.publicBaseUrl.replace(/\/$/, "");
    return {
      filename: destName,
      url: `${base}/${destName}`,
      mimeType,
      sizeBytes: stat.size,
    };
  }

  /** Delete only URLs we host (R2 marketing/ or local /cms/). No-op for external URLs. */
  async deleteManagedUrl(url: string | null | undefined) {
    if (!url?.trim()) return;
    const trimmed = url.trim();
    try {
      if (this.storage.isCloudEnabled()) {
        const key = this.storage.keyFromPublicUrl(trimmed);
        if (!key || !key.startsWith(`${MARKETING_PREFIX}/`)) return;
        await this.storage.deleteObject(key);
        return;
      }
      const base = this.publicBaseUrl.replace(/\/$/, "");
      if (
        !trimmed.startsWith(base) &&
        !trimmed.includes("/cms/") &&
        !trimmed.endsWith("/cms")
      ) {
        return;
      }
      await this.deleteByUrl(trimmed);
    } catch {
      // Best-effort cleanup — don't fail the parent delete.
    }
  }

  async deleteByUrl(url: string) {
    if (this.storage.isCloudEnabled()) {
      const key = this.storage.keyFromPublicUrl(url);
      if (key) {
        await this.storage.deleteObject(key);
      }
      return;
    }

    const base = this.publicBaseUrl.replace(/\/$/, "");
    let filename: string | null = null;
    if (url.startsWith(base + "/")) {
      filename = url.slice(base.length + 1);
    } else {
      const idx = url.indexOf("/cms/");
      if (idx >= 0) filename = url.slice(idx + "/cms/".length);
    }
    if (!filename || filename.includes("..")) return;
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  private extFromMime(mime: string) {
    if (mime === "image/png") return ".png";
    if (mime === "image/jpeg") return ".jpg";
    if (mime === "image/webp") return ".webp";
    return ".bin";
  }

  private mimeFromExt(ext: string) {
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    return "application/octet-stream";
  }
}

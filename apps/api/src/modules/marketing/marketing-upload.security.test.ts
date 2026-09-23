import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  IMAGE_SLOT_SPECS,
  MARKETING_UPLOAD_MAX_BYTES,
  MARKETING_UPLOAD_MAX_PIXELS,
  MarketingUploadService,
  probeImageDimensions,
} from "./marketing-upload.service";

const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

function validateUploadMime(mimetype: string) {
  if (!ALLOWED_MIMES.has(mimetype)) {
    throw new Error("Unsupported file type. Use PNG, JPG, or WebP.");
  }
}

/** Minimal buffer that probeImageDimensions accepts as PNG. */
function fakePngBuffer(width: number, height: number, byteLength = 64): Buffer {
  const buf = Buffer.alloc(Math.max(byteLength, 24));
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function fakeMulterFile(
  opts: {
    width?: number;
    height?: number;
    mimetype?: string;
    /** Reported multer size (may exceed buffer length for size-limit tests). */
    size?: number;
    noBuffer?: boolean;
  } = {},
): Express.Multer.File {
  const width = opts.width ?? 800;
  const height = opts.height ?? 600;
  const buffer = opts.noBuffer
    ? (undefined as unknown as Buffer)
    : fakePngBuffer(width, height, 64);
  return {
    fieldname: "file",
    originalname: "photo.png",
    encoding: "7bit",
    mimetype: opts.mimetype ?? "image/png",
    size: opts.size ?? buffer?.length ?? 0,
    buffer,
    destination: "",
    filename: "",
    path: "",
    stream: null as never,
  };
}

function makeUploadService(opts?: { cloud?: boolean }) {
  const cloud = opts?.cloud ?? false;
  const storage = {
    isCloudEnabled: () => cloud,
    putObject: vi.fn(async ({ key }: { key: string }) => ({
      key,
      url: `https://cdn.example/${key}`,
    })),
    deleteObject: vi.fn(),
    keyFromPublicUrl: vi.fn(),
  };
  return { service: new MarketingUploadService(storage as never), storage };
}

describe("marketing upload MIME allowlist", () => {
  it("rejects SVG uploads (stored XSS vector)", () => {
    expect(() => validateUploadMime("image/svg+xml")).toThrow(/Unsupported/);
  });

  it("allows PNG/JPEG/WebP", () => {
    expect(() => validateUploadMime("image/png")).not.toThrow();
    expect(() => validateUploadMime("image/jpeg")).not.toThrow();
    expect(() => validateUploadMime("image/webp")).not.toThrow();
  });
});

describe("probeImageDimensions", () => {
  it("reads PNG width/height", () => {
    expect(probeImageDimensions(fakePngBuffer(1200, 900))).toEqual({
      width: 1200,
      height: 900,
    });
  });
});

describe("IMAGE_SLOT_SPECS limits", () => {
  it("uses unified 5 MB max for every slot", () => {
    for (const spec of Object.values(IMAGE_SLOT_SPECS)) {
      expect(spec.maxBytes).toBe(MARKETING_UPLOAD_MAX_BYTES);
    }
    expect(MARKETING_UPLOAD_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("MarketingUploadService.validateSlot", () => {
  const { service } = makeUploadService();

  it("rejects missing file", () => {
    expect(() =>
      service.validateFile(fakeMulterFile({ noBuffer: true })),
    ).toThrow(BadRequestException);
  });

  it("rejects SVG MIME", () => {
    expect(() =>
      service.validateFile(fakeMulterFile({ mimetype: "image/svg+xml" })),
    ).toThrow(/Unsupported/);
  });

  it("rejects files over 5 MB", () => {
    const file = fakeMulterFile({
      width: 800,
      height: 600,
      size: MARKETING_UPLOAD_MAX_BYTES + 1,
    });
    expect(() => service.validateFile(file)).toThrow(/too large/i);
  });

  it("accepts non-square menu images (soft aspect ratio)", () => {
    const file = fakeMulterFile({ width: 1200, height: 900 });
    expect(() => service.validateSlot(file, "menuItem")).not.toThrow();
  });

  it("accepts non-16:9 outlet covers", () => {
    const file = fakeMulterFile({ width: 1000, height: 1000 });
    expect(() => service.validateSlot(file, "outletCover")).not.toThrow();
  });

  it("rejects images above max pixel dimension", () => {
    const file = fakeMulterFile({
      width: MARKETING_UPLOAD_MAX_PIXELS + 1,
      height: 800,
    });
    expect(() => service.validateSlot(file, "menuItem")).toThrow(
      /too large|Maximum dimension/i,
    );
  });
});

describe("MarketingUploadService.saveUploadedFile gallery keys", () => {
  it("preserves unique slotKey filenames for gallery photos", async () => {
    const { service, storage } = makeUploadService({ cloud: true });
    const file = fakeMulterFile({ width: 1200, height: 900 });
    const keyA = `outlet-photo-out1-aaa-bbb`;
    const keyB = `outlet-photo-out1-ccc-ddd`;
    const a = await service.saveUploadedFile(file, keyA, "outletGallery");
    const b = await service.saveUploadedFile(file, keyB, "outletGallery");
    expect(a.filename.startsWith(keyA)).toBe(true);
    expect(b.filename.startsWith(keyB)).toBe(true);
    expect(a.filename).not.toBe(b.filename);
    expect(storage.putObject).toHaveBeenCalledTimes(2);
  });
});

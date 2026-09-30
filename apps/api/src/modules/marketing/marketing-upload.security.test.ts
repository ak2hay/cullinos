import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  ALLOWED_IMAGE_MIMES,
  IMAGE_SLOT_SPECS,
  MARKETING_UPLOAD_MAX_BYTES,
  MARKETING_UPLOAD_MAX_PIXELS,
  MarketingUploadService,
  TENANT_UPLOAD_MAX_BYTES,
  buildStorageKey,
  marketingImageFileFilter,
  probeImageDimensions,
  sniffImageMime,
  uploadMaxBytesFor,
} from "./marketing-upload.service";

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
    originalname?: string;
    buffer?: Buffer;
  } = {},
): Express.Multer.File {
  const width = opts.width ?? 800;
  const height = opts.height ?? 600;
  const buffer = opts.noBuffer
    ? (undefined as unknown as Buffer)
    : (opts.buffer ?? fakePngBuffer(width, height, 64));
  return {
    fieldname: "file",
    originalname: opts.originalname ?? "photo.png",
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

/** Real PNG so sharp re-encoding succeeds. */
async function realPngFile(width: number, height: number): Promise<Express.Multer.File> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 80, b: 40 } },
  })
    .png()
    .toBuffer();
  return fakeMulterFile({ buffer });
}

function makeUploadService(opts?: { cloud?: boolean; prisma?: unknown }) {
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
  return {
    service: new MarketingUploadService(storage as never, opts?.prisma as never),
    storage,
  };
}

describe("marketing upload MIME allowlist", () => {
  it("rejects SVG uploads (stored XSS vector)", () => {
    expect(ALLOWED_IMAGE_MIMES.has("image/svg+xml")).toBe(false);
  });

  it("allows PNG/JPEG/WebP", () => {
    expect(ALLOWED_IMAGE_MIMES.has("image/png")).toBe(true);
    expect(ALLOWED_IMAGE_MIMES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_IMAGE_MIMES.has("image/webp")).toBe(true);
  });
});

describe("sniffImageMime", () => {
  it("detects PNG magic", () => {
    expect(sniffImageMime(fakePngBuffer(10, 10))).toBe("image/png");
  });

  it("rejects SVG / non-image buffers", () => {
    expect(sniffImageMime(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });
});

describe("marketingImageFileFilter", () => {
  it("rejects SVG by MIME", () => {
    const cb = vi.fn();
    marketingImageFileFilter(
      {} as never,
      fakeMulterFile({ mimetype: "image/svg+xml", originalname: "x.svg" }),
      cb,
    );
    expect(cb.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
    expect(cb.mock.calls[0][1]).toBe(false);
  });

  it("accepts PNG", () => {
    const cb = vi.fn();
    marketingImageFileFilter({} as never, fakeMulterFile(), cb);
    expect(cb).toHaveBeenCalledWith(null, true);
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

describe("buildStorageKey", () => {
  it("builds org menu path", () => {
    expect(
      buildStorageKey(
        {
          scope: "org",
          orgId: "org1",
          leafName: "item1",
          imageSlot: "menuItem",
        },
        ".jpg",
      ),
    ).toBe("marketing/orgs/org1/menu/item1.jpg");
  });

  it("builds outlet cover and gallery paths", () => {
    expect(
      buildStorageKey(
        {
          scope: "org",
          orgId: "org1",
          outletId: "out1",
          imageSlot: "outletCover",
        },
        ".png",
      ),
    ).toBe("marketing/orgs/org1/outlets/out1/cover.png");

    const gallery = buildStorageKey(
      {
        scope: "org",
        orgId: "org1",
        outletId: "out1",
        leafName: "aaa-bbb",
        imageSlot: "outletGallery",
      },
      ".webp",
    );
    expect(gallery).toBe("marketing/orgs/org1/outlets/out1/gallery/aaa-bbb.webp");
  });

  it("builds platform CMS and guest-ops paths", () => {
    expect(
      buildStorageKey(
        { scope: "platform", platformArea: "cms", leafName: "heroRestaurant" },
        ".png",
      ),
    ).toBe("marketing/platform/cms/heroRestaurant.png");

    expect(
      buildStorageKey(
        {
          scope: "platform",
          platformArea: "guest-ops",
          leafName: "banner1",
          imageSlot: "banner",
        },
        ".jpg",
      ),
    ).toBe("marketing/platform/guest-ops/banners/banner1.jpg");

    expect(
      buildStorageKey(
        {
          scope: "platform",
          platformArea: "guest-ops",
          leafName: "push1",
          imageSlot: "notification",
        },
        ".jpg",
      ),
    ).toBe("marketing/platform/guest-ops/push/push1.jpg");
  });

  it("keeps staff avatars inside the tenant folder and super-admin avatars on the platform", () => {
    expect(
      buildStorageKey({ scope: "org", orgId: "org1", leafName: "u1-abc", imageSlot: "avatar" }, ".jpg"),
    ).toBe("marketing/orgs/org1/avatars/u1-abc.jpg");
    expect(
      buildStorageKey(
        { scope: "platform", platformArea: "avatars", leafName: "u2-abc", imageSlot: "avatar" },
        ".png",
      ),
    ).toBe("marketing/platform/avatars/u2-abc.png");
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

  it("rejects SVG MIME even with PNG buffer spoof attempt when MIME is SVG", () => {
    expect(() =>
      service.validateFile(fakeMulterFile({ mimetype: "image/svg+xml" })),
    ).toThrow(/Unsupported|does not match/i);
  });

  it("rejects MIME spoofing (claims JPEG, buffer is PNG)", () => {
    expect(() =>
      service.validateFile(fakeMulterFile({ mimetype: "image/jpeg" })),
    ).toThrow(/does not match/i);
  });

  it("rejects non-image buffer claiming PNG", () => {
    expect(() =>
      service.validateFile(
        fakeMulterFile({
          mimetype: "image/png",
          buffer: Buffer.from("not an image"),
        }),
      ),
    ).toThrow(/Unsupported/i);
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

describe("tenant vs super-admin upload limits", () => {
  const { service } = makeUploadService();
  const threeMb = 3 * 1024 * 1024;

  it("caps tenant users at 2 MB", () => {
    expect(TENANT_UPLOAD_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(uploadMaxBytesFor({ isSuperAdmin: false })).toBe(TENANT_UPLOAD_MAX_BYTES);
    expect(uploadMaxBytesFor(undefined)).toBe(TENANT_UPLOAD_MAX_BYTES);
  });

  it("exempts super admins and impersonation sessions", () => {
    expect(uploadMaxBytesFor({ isSuperAdmin: true })).toBe(MARKETING_UPLOAD_MAX_BYTES);
    expect(uploadMaxBytesFor({ isSuperAdmin: false, impersonatedBy: "sa-1" })).toBe(
      MARKETING_UPLOAD_MAX_BYTES,
    );
  });

  it("rejects a 3 MB tenant upload", () => {
    const file = fakeMulterFile({ size: threeMb });
    expect(() =>
      service.validateSlot(file, "menuItem", uploadMaxBytesFor({ isSuperAdmin: false })),
    ).toThrow(/too large/i);
  });

  it("accepts a 3 MB super-admin upload", () => {
    const file = fakeMulterFile({ size: threeMb });
    expect(() =>
      service.validateSlot(file, "menuItem", uploadMaxBytesFor({ isSuperAdmin: true })),
    ).not.toThrow();
  });
});

describe("MarketingUploadService.saveUploadedFile hierarchical keys", () => {
  it("writes unique gallery keys under org/outlet path", async () => {
    const { service, storage } = makeUploadService({ cloud: true });
    const file = await realPngFile(1200, 900);
    const a = await service.saveUploadedFile(file, {
      scope: "org",
      orgId: "org1",
      outletId: "out1",
      leafName: "aaa-bbb",
      imageSlot: "outletGallery",
    });
    const b = await service.saveUploadedFile(file, {
      scope: "org",
      orgId: "org1",
      outletId: "out1",
      leafName: "ccc-ddd",
      imageSlot: "outletGallery",
    });
    expect(a.filename).toBe("orgs/org1/outlets/out1/gallery/aaa-bbb.png");
    expect(b.filename).toBe("orgs/org1/outlets/out1/gallery/ccc-ddd.png");
    expect(a.filename).not.toBe(b.filename);
    expect(storage.putObject).toHaveBeenCalledTimes(2);
    expect(storage.putObject).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key: "marketing/orgs/org1/outlets/out1/gallery/aaa-bbb.png",
        contentType: "image/png",
      }),
    );
  });

  it("writes menu item under orgs/.../menu/", async () => {
    const { service, storage } = makeUploadService({ cloud: true });
    const file = await realPngFile(800, 800);
    await service.saveUploadedFile(file, {
      scope: "org",
      orgId: "org9",
      leafName: "item9",
      imageSlot: "menuItem",
    });
    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "marketing/orgs/org9/menu/item9.png",
      }),
    );
  });

  it("writes platform CMS assets under platform/cms/", async () => {
    const { service, storage } = makeUploadService({ cloud: true });
    const file = await realPngFile(800, 600);
    const saved = await service.saveUploadedFile(file, {
      scope: "platform",
      platformArea: "cms",
      leafName: "heroRestaurant",
    });
    expect(saved.filename).toBe("platform/cms/heroRestaurant.png");
    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "marketing/platform/cms/heroRestaurant.png",
      }),
    );
  });

  it("rejects bytes that only look like an image", async () => {
    const { service, storage } = makeUploadService({ cloud: true });
    const file = fakeMulterFile({ width: 800, height: 600 });
    await expect(
      service.saveUploadedFile(file, { scope: "platform", platformArea: "cms", leafName: "x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("strips metadata by re-encoding before storing", async () => {
    const { service, storage } = makeUploadService({ cloud: true });
    const withExif = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-owner" } } })
      .toBuffer();
    expect(withExif.includes("secret-gps-owner")).toBe(true);
    await service.saveUploadedFile(
      fakeMulterFile({ buffer: withExif, mimetype: "image/jpeg", originalname: "p.jpg" }),
      { scope: "platform", platformArea: "cms", leafName: "p" },
    );
    const stored = storage.putObject.mock.calls[0][0] as unknown as { body: Buffer };
    expect(stored.body.includes("secret-gps-owner")).toBe(false);
  });

  it("enforces the per-org storage quota", async () => {
    const prisma = {
      storedObject: {
        aggregate: vi.fn(async () => ({ _sum: { sizeBytes: 500 * 1024 * 1024 } })),
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(),
      },
    };
    const { service, storage } = makeUploadService({ cloud: true, prisma });
    const file = await realPngFile(800, 800);
    await expect(
      service.saveUploadedFile(file, { scope: "org", orgId: "org1", leafName: "big", imageSlot: "menuItem" }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.storedObject.upsert).not.toHaveBeenCalled();
  });
});

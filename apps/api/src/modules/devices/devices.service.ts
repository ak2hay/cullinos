import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DEFAULT_KOT_PROFILE,
  DEFAULT_RECEIPT_PROFILE,
  type DeviceMetadata,
  type PrintProfile,
  type PrintProfileKind,
} from "./print-profile.types";

const DEVICE_TYPES = ["pos", "kds", "printer", "gateway", "scanner", "other"] as const;

type PairingSession = {
  orgId: string;
  type: string;
  outletId?: string;
  nameHint?: string;
  expiresAt: number;
};

const pairingSessions = new Map<string, PairingSession>();

function isSystemDeviceName(name: string): boolean {
  return (
    name === "__print_profiles__" ||
    name.startsWith("__display:")
  );
}

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, opts?: { includeVirtual?: boolean }) {
    return this.prisma.device
      .findMany({
        where: {
          organizationId: orgId,
          ...(opts?.includeVirtual
            ? { NOT: { name: "__print_profiles__" } }
            : {
                NOT: {
                  OR: [
                    { name: "__print_profiles__" },
                    { name: { startsWith: "__display:" } },
                  ],
                },
              }),
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        take: 200,
      });
  }

  private async assertUniqueName(
    orgId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.device.findFirst({
      where: {
        organizationId: orgId,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        `A device named "${existing.name}" is already registered`,
      );
    }
  }

  async create(
    orgId: string,
    data: {
      name: string;
      type: string;
      outletId?: string;
      identifier?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");
    const name = data.name.trim();
    if (isSystemDeviceName(name)) {
      throw new BadRequestException("Reserved device name");
    }
    const type = (data.type || "printer").toLowerCase();
    if (!(DEVICE_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(
        `type must be one of: ${DEVICE_TYPES.join(", ")}`,
      );
    }

    if (data.outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: data.outletId, organizationId: orgId },
      });
      if (!outlet) throw new NotFoundException("Outlet not found");
    }

    await this.assertUniqueName(orgId, name);

    return this.prisma.device.create({
      data: {
        organizationId: orgId,
        name,
        type: type as never,
        outletId: data.outletId || null,
        identifier: data.identifier?.trim() || null,
        metadata: (data.metadata ?? {}) as object,
        lastSeenAt: new Date(),
      },
    });
  }

  async update(
    orgId: string,
    id: string,
    data: {
      name?: string;
      type?: string;
      outletId?: string | null;
      identifier?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const device = await this.prisma.device.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!device || isSystemDeviceName(device.name)) {
      throw new NotFoundException("Device not found");
    }

    if (data.name?.trim()) {
      const name = data.name.trim();
      if (isSystemDeviceName(name)) {
        throw new BadRequestException("Reserved device name");
      }
      await this.assertUniqueName(orgId, name, id);
    }

    if (data.type) {
      const type = data.type.toLowerCase();
      if (!(DEVICE_TYPES as readonly string[]).includes(type)) {
        throw new BadRequestException(
          `type must be one of: ${DEVICE_TYPES.join(", ")}`,
        );
      }
    }

    if (data.outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: data.outletId, organizationId: orgId },
      });
      if (!outlet) throw new NotFoundException("Outlet not found");
    }

    const prevMeta = (device.metadata ?? {}) as Record<string, unknown>;
    return this.prisma.device.update({
      where: { id },
      data: {
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(data.type ? { type: data.type.toLowerCase() as never } : {}),
        ...(data.outletId !== undefined ? { outletId: data.outletId } : {}),
        ...(data.identifier !== undefined
          ? { identifier: data.identifier?.trim() || null }
          : {}),
        ...(data.metadata
          ? { metadata: { ...prevMeta, ...data.metadata } as object }
          : {}),
      },
    });
  }

  async delete(orgId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!device || isSystemDeviceName(device.name)) {
      throw new NotFoundException("Device not found");
    }
    await this.prisma.deviceRegistration.deleteMany({ where: { deviceId: id } });
    await this.prisma.device.delete({ where: { id } });
    return { ok: true };
  }

  /** Create a short-lived pairing code for QR / manual claim. */
  createPairingSession(
    orgId: string,
    body: { type?: string; outletId?: string; nameHint?: string },
  ) {
    const type = (body.type || "printer").toLowerCase();
    if (!(DEVICE_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(
        `type must be one of: ${DEVICE_TYPES.join(", ")}`,
      );
    }
    const code = randomBytes(3).toString("hex").toUpperCase();
    pairingSessions.set(code, {
      orgId,
      type,
      outletId: body.outletId,
      nameHint: body.nameHint,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return {
      code,
      expiresInSeconds: 600,
      qrPayload: `cullinos://pair?code=${code}`,
    };
  }

  async claimPairing(
    orgId: string,
    body: { code: string; name?: string; platform?: string },
  ) {
    const code = body.code?.trim().toUpperCase();
    if (!code) throw new BadRequestException("code is required");
    const session = pairingSessions.get(code);
    if (!session || session.orgId !== orgId || session.expiresAt < Date.now()) {
      pairingSessions.delete(code);
      throw new BadRequestException("Invalid or expired pairing code");
    }
    pairingSessions.delete(code);

    const name =
      body.name?.trim() ||
      session.nameHint?.trim() ||
      `${session.type.toUpperCase()} ${code.slice(0, 4)}`;

    const device = await this.create(orgId, {
      name,
      type: session.type,
      outletId: session.outletId,
      metadata: { pairedVia: "code", pairedAt: new Date().toISOString() },
    });

    const token = randomBytes(24).toString("hex");
    await this.prisma.deviceRegistration.create({
      data: {
        deviceId: device.id,
        token,
        platform: body.platform?.trim() || "browser",
      },
    });

    return { device, token };
  }

  async createPrintJob(
    orgId: string,
    data: {
      outletId?: string;
      deviceId?: string;
      orderId?: string;
      kind?: string;
      status?: "pending" | "sent" | "failed" | "done";
      error?: string;
      payloadSummary?: string;
    },
  ) {
    return this.prisma.printJob.create({
      data: {
        organizationId: orgId,
        outletId: data.outletId || null,
        deviceId: data.deviceId || null,
        orderId: data.orderId || null,
        kind: data.kind || "receipt",
        status: (data.status || "pending") as never,
        error: data.error || null,
        payloadSummary: data.payloadSummary || null,
      },
    });
  }

  listPrintJobs(
    orgId: string,
    opts?: { status?: string; take?: number },
  ) {
    return this.prisma.printJob.findMany({
      where: {
        organizationId: orgId,
        ...(opts?.status ? { status: opts.status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(opts?.take ?? 50, 200),
      include: { device: { select: { id: true, name: true, type: true } } },
    });
  }

  async updatePrintJob(
    orgId: string,
    id: string,
    data: { status?: string; error?: string | null },
  ) {
    const job = await this.prisma.printJob.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!job) throw new NotFoundException("Print job not found");
    return this.prisma.printJob.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status as never } : {}),
        ...(data.error !== undefined ? { error: data.error } : {}),
      },
    });
  }

  async getPrintProfiles(orgId: string, outletId: string) {
    await this.requireOutlet(orgId, outletId);
    const store = await this.profileStoreDevice(orgId, outletId);
    const metadata = (store.metadata ?? {}) as DeviceMetadata;
    return {
      outletId,
      receipt: metadata.printProfiles?.receipt ?? DEFAULT_RECEIPT_PROFILE(outletId),
      kot: metadata.printProfiles?.kot ?? DEFAULT_KOT_PROFILE(outletId),
    };
  }

  async getPrintProfile(orgId: string, outletId: string, kind: PrintProfileKind) {
    const profiles = await this.getPrintProfiles(orgId, outletId);
    return profiles[kind];
  }

  async upsertPrintProfile(
    orgId: string,
    outletId: string,
    kind: PrintProfileKind,
    patch: Partial<Omit<PrintProfile, "kind" | "outletId">>,
  ) {
    await this.requireOutlet(orgId, outletId);
    const store = await this.profileStoreDevice(orgId, outletId);
    const metadata = (store.metadata ?? {}) as DeviceMetadata;
    const current =
      metadata.printProfiles?.[kind] ??
      (kind === "receipt"
        ? DEFAULT_RECEIPT_PROFILE(outletId)
        : DEFAULT_KOT_PROFILE(outletId));

    const next: PrintProfile = {
      ...current,
      ...patch,
      kind,
      outletId,
      paperWidthMm: patch.paperWidthMm ?? current.paperWidthMm,
      fontSize: patch.fontSize ?? current.fontSize,
      showLogo: patch.showLogo ?? current.showLogo,
      showTaxBreakdown: patch.showTaxBreakdown ?? current.showTaxBreakdown,
      copies: patch.copies ?? current.copies,
      cutPaper: patch.cutPaper ?? current.cutPaper,
    };

    const printProfiles = {
      ...metadata.printProfiles,
      [kind]: next,
    };

    await this.prisma.device.update({
      where: { id: store.id },
      data: { metadata: { ...metadata, printProfiles } as object },
    });

    return next;
  }

  private async requireOutlet(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return outlet;
  }

  /** Upsert a virtual display device row and stamp lastSeenAt. */
  async upsertDisplayHeartbeat(orgId: string, outletId: string, mode: string) {
    const name = `__display:${mode}__`;
    const existing = await this.prisma.device.findFirst({
      where: { organizationId: orgId, outletId, name },
    });
    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      await this.prisma.device.create({
        data: {
          organizationId: orgId,
          outletId,
          name,
          type: "kds",
          lastSeenAt: new Date(),
        },
      });
    }
    return { ok: true };
  }

  private async profileStoreDevice(orgId: string, outletId: string) {
    const existing = await this.prisma.device.findFirst({
      where: {
        organizationId: orgId,
        outletId,
        type: "printer",
        name: "__print_profiles__",
      },
    });
    if (existing) return existing;

    return this.prisma.device.create({
      data: {
        organizationId: orgId,
        outletId,
        type: "printer",
        name: "__print_profiles__",
        identifier: "print-profiles",
        metadata: { printProfiles: {} },
      },
    });
  }
}

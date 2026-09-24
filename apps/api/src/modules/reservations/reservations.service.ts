import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import {
  generateReservationSlots,
  readReservationSlotSettings,
} from "../../common/reservation-slots.util";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { Msg91Service } from "../sms/msg91.service";
import {
  smsReservationConfirmed,
  smsReservationInvite,
} from "../sms/sms-templates";
import { StorefrontService } from "../storefront/storefront.service";

function bookingToken(): string {
  return randomBytes(16).toString("hex");
}

function inviteToken(): string {
  return randomBytes(24).toString("hex");
}

function settingsRecord(settings: unknown): Record<string, unknown> {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as Record<string, unknown>;
  }
  return {};
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private prisma: PrismaService,
    private storefront: StorefrontService,
    private mail: MailService,
    private sms: Msg91Service,
  ) {}

  list(orgId: string, params: { outletId?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (params.outletId) where.outletId = params.outletId;
    if (params.from || params.to) {
      const gte = params.from ? new Date(params.from) : undefined;
      const lte = params.to ? new Date(params.to) : undefined;
      if (lte) lte.setHours(23, 59, 59, 999);
      where.reservedAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }
    return this.prisma.reservation.findMany({
      where,
      orderBy: { reservedAt: "asc" },
      take: 500,
      include: {
        outlet: { select: { id: true, name: true } },
        table: { select: { id: true, name: true } },
      },
    });
  }

  get(orgId: string, id: string) {
    return this.prisma.reservation.findFirstOrThrow({
      where: { id, organizationId: orgId },
      include: {
        outlet: { select: { id: true, name: true } },
        table: { select: { id: true, name: true } },
      },
    });
  }

  private async loadOutletWithSettings(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
      include: {
        settings: true,
        organization: { select: { id: true, slug: true, name: true, timezone: true } },
      },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return outlet;
  }

  async getReservationSettings(orgId: string, outletId: string) {
    const outlet = await this.loadOutletWithSettings(orgId, outletId);
    return {
      outletId: outlet.id,
      ...readReservationSlotSettings(outlet.settings?.settings),
    };
  }

  async updateReservationSettings(
    orgId: string,
    outletId: string,
    body: { reservationSlotMinutes?: number; reservationMaxCoversPerSlot?: number },
  ) {
    const outlet = await this.loadOutletWithSettings(orgId, outletId);
    const current = settingsRecord(outlet.settings?.settings);
    const next = {
      ...current,
      ...(body.reservationSlotMinutes !== undefined
        ? { reservationSlotMinutes: body.reservationSlotMinutes }
        : {}),
      ...(body.reservationMaxCoversPerSlot !== undefined
        ? { reservationMaxCoversPerSlot: body.reservationMaxCoversPerSlot }
        : {}),
    };
    const validated = readReservationSlotSettings(next);
    next.reservationSlotMinutes = validated.reservationSlotMinutes;
    next.reservationMaxCoversPerSlot = validated.reservationMaxCoversPerSlot;

    await this.prisma.outletSettings.upsert({
      where: { outletId },
      create: { outletId, settings: next as never },
      update: { settings: next as never },
    });
    return { outletId, ...validated };
  }

  async listSlotsForOutlet(
    orgId: string | null,
    outletId: string,
    dateYmd: string,
    partySize = 1,
  ) {
    const outlet = orgId
      ? await this.loadOutletWithSettings(orgId, outletId)
      : await this.prisma.outlet.findFirst({
          where: { id: outletId },
          include: {
            settings: true,
            organization: { select: { id: true, slug: true, name: true, timezone: true } },
          },
        });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const slotSettings = readReservationSlotSettings(outlet.settings?.settings);
    const openingHours = settingsRecord(outlet.settings?.settings).openingHours;
    const dayStart = new Date(`${dateYmd}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateYmd}T23:59:59.999Z`);
    // Wider window for timezone skew
    dayStart.setUTCDate(dayStart.getUTCDate() - 1);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const bookings = await this.prisma.reservation.findMany({
      where: {
        outletId: outlet.id,
        reservedAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["cancelled", "no_show"] },
      },
      select: { reservedAt: true, partySize: true },
    });

    const slots = generateReservationSlots({
      dateYmd,
      openingHours,
      timeZone: outlet.organization.timezone || "Asia/Kolkata",
      slotMinutes: slotSettings.reservationSlotMinutes,
      maxCovers: slotSettings.reservationMaxCoversPerSlot,
      bookings,
      partySize,
    });

    return {
      outletId: outlet.id,
      outletName: outlet.name,
      date: dateYmd,
      ...slotSettings,
      slots,
    };
  }

  async publicSlots(params: {
    orgSlug: string;
    outletSlug: string;
    date: string;
    partySize?: number;
  }) {
    const { organization, outlet } = await this.storefront.resolveActiveOutlet(
      params.orgSlug,
      params.outletSlug,
    );
    return this.listSlotsForOutlet(
      organization.id,
      outlet.id,
      params.date,
      params.partySize ?? 1,
    );
  }

  private async assertSlotAvailable(
    outletId: string,
    reservedAt: Date,
    partySize: number,
    orgTimezone: string,
    openingHours: unknown,
    slotSettings: ReturnType<typeof readReservationSlotSettings>,
  ) {
    const ymd = reservedAt.toLocaleDateString("en-CA", { timeZone: orgTimezone });
    const dayStart = new Date(reservedAt.getTime() - 36 * 60 * 60 * 1000);
    const dayEnd = new Date(reservedAt.getTime() + 36 * 60 * 60 * 1000);
    const bookings = await this.prisma.reservation.findMany({
      where: {
        outletId,
        reservedAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["cancelled", "no_show"] },
      },
      select: { reservedAt: true, partySize: true },
    });
    const slots = generateReservationSlots({
      dateYmd: ymd,
      openingHours,
      timeZone: orgTimezone,
      slotMinutes: slotSettings.reservationSlotMinutes,
      maxCovers: slotSettings.reservationMaxCoversPerSlot,
      bookings,
      partySize,
      now: new Date(0), // allow past check separately
    });
    const match = slots.find(
      (s) => Math.abs(new Date(s.startAt).getTime() - reservedAt.getTime()) < 60_000,
    );
    if (!match) {
      throw new BadRequestException("Selected time is not an available reservation slot");
    }
    if (!match.available) {
      throw new BadRequestException("Selected slot does not have enough capacity");
    }
    if (reservedAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException("Cannot book a past slot");
    }
  }

  private async notifyConfirmation(input: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    outletName: string;
    reservedAt: Date;
    partySize: number;
  }): Promise<{ emailSent: boolean; smsSent: boolean }> {
    let emailSent = false;
    let smsSent = false;
    if (input.customerEmail) {
      try {
        emailSent = await this.mail.sendReservationConfirmation({
          to: input.customerEmail,
          customerName: input.customerName,
          outletName: input.outletName,
          reservedAt: input.reservedAt,
          partySize: input.partySize,
        });
      } catch (err) {
        this.logger.warn(
          `Reservation confirmation email failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    if (input.customerPhone) {
      try {
        const when = input.reservedAt.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        });
        const result = await this.sms.sendTransactionalSms(
          input.customerPhone,
          smsReservationConfirmed({
            outletName: input.outletName,
            when,
            partySize: input.partySize,
          }),
        );
        smsSent = result.sent;
      } catch (err) {
        this.logger.warn(
          `Reservation confirmation SMS failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { emailSent, smsSent };
  }

  async create(
    orgId: string,
    body: {
      outletId: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      partySize: number;
      reservedAt: string;
      tableId?: string;
      notes?: string;
      status?: string;
      skipSlotCheck?: boolean;
    },
  ) {
    if (body.partySize < 1) {
      throw new BadRequestException("partySize must be at least 1");
    }
    const outlet = await this.loadOutletWithSettings(orgId, body.outletId);
    const reservedAt = new Date(body.reservedAt);
    if (Number.isNaN(reservedAt.getTime())) {
      throw new BadRequestException("Invalid reservedAt");
    }

    const slotSettings = readReservationSlotSettings(outlet.settings?.settings);
    const openingHours = settingsRecord(outlet.settings?.settings).openingHours;
    if (!body.skipSlotCheck) {
      await this.assertSlotAvailable(
        outlet.id,
        reservedAt,
        body.partySize,
        outlet.organization.timezone || "Asia/Kolkata",
        openingHours,
        slotSettings,
      );
    }

    const status = (body.status as "pending" | "confirmed") || "confirmed";
    const reservation = await this.prisma.reservation.create({
      data: {
        organizationId: orgId,
        outletId: body.outletId,
        customerName: body.customerName.trim(),
        customerPhone: body.customerPhone.trim(),
        customerEmail: body.customerEmail?.trim() || null,
        partySize: body.partySize,
        reservedAt,
        tableId: body.tableId || null,
        notes: body.notes?.trim() || null,
        bookingToken: bookingToken(),
        status,
      },
    });

    const notify = await this.notifyConfirmation({
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      outletName: outlet.name,
      reservedAt: reservation.reservedAt,
      partySize: reservation.partySize,
    });

    return { ...reservation, ...notify };
  }

  async update(
    orgId: string,
    id: string,
    body: {
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      partySize?: number;
      reservedAt?: string;
      tableId?: string | null;
      status?: string;
      notes?: string;
    },
  ) {
    const existing = await this.get(orgId, id);
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        ...(body.customerName !== undefined
          ? { customerName: body.customerName.trim() }
          : {}),
        ...(body.customerPhone !== undefined
          ? { customerPhone: body.customerPhone.trim() }
          : {}),
        ...(body.customerEmail !== undefined
          ? { customerEmail: body.customerEmail?.trim() || null }
          : {}),
        ...(body.partySize !== undefined ? { partySize: body.partySize } : {}),
        ...(body.reservedAt !== undefined
          ? { reservedAt: new Date(body.reservedAt) }
          : {}),
        ...(body.tableId !== undefined ? { tableId: body.tableId } : {}),
        ...(body.status !== undefined ? { status: body.status as never } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
      },
      include: { outlet: { select: { name: true } } },
    });

    if (
      body.status === "confirmed" &&
      existing.status !== "confirmed" &&
      updated.status === "confirmed"
    ) {
      await this.notifyConfirmation({
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        customerEmail: updated.customerEmail,
        outletName: updated.outlet.name,
        reservedAt: updated.reservedAt,
        partySize: updated.partySize,
      });
    }

    return updated;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.reservation.delete({ where: { id } });
    return { success: true, id };
  }

  getPublicBookLink(
    orgSlug: string,
    outletSlug: string,
    baseUrl?: string,
    inviteTokenValue?: string,
  ) {
    const root =
      baseUrl?.replace(/\/$/, "") ||
      process.env.PUBLIC_BOOK_URL?.replace(/\/$/, "") ||
      process.env.WEB_APP_URL?.replace(/\/$/, "") ||
      process.env.GUEST_APP_URL?.replace(/\/$/, "") ||
      "https://www.cullinos.com";
    if (inviteTokenValue) {
      return `${root}/book?invite=${encodeURIComponent(inviteTokenValue)}`;
    }
    return `${root}/book?orgSlug=${encodeURIComponent(orgSlug)}&outletSlug=${encodeURIComponent(outletSlug)}`;
  }

  async createInvite(
    orgId: string,
    body: {
      outletId: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      expiresInDays?: number;
    },
  ) {
    const outlet = await this.loadOutletWithSettings(orgId, body.outletId);
    if (!body.customerName?.trim() || !body.customerPhone?.trim()) {
      throw new BadRequestException("customerName and customerPhone are required");
    }
    if (!body.customerEmail?.trim() && !body.customerPhone?.trim()) {
      throw new BadRequestException("Provide email or phone to send the invitation");
    }

    const days = body.expiresInDays && body.expiresInDays > 0 ? body.expiresInDays : 7;
    const token = inviteToken();
    const invite = await this.prisma.reservationInvite.create({
      data: {
        organizationId: orgId,
        outletId: outlet.id,
        customerName: body.customerName.trim(),
        customerPhone: body.customerPhone.trim(),
        customerEmail: body.customerEmail?.trim() || null,
        token,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        status: "sent",
      },
    });

    const bookUrl = this.getPublicBookLink(
      outlet.organization.slug,
      outlet.slug,
      undefined,
      token,
    );

    let emailSent = false;
    let smsSent = false;
    if (invite.customerEmail) {
      try {
        emailSent = await this.mail.sendReservationInvite({
          to: invite.customerEmail,
          customerName: invite.customerName,
          outletName: outlet.name,
          bookUrl,
        });
      } catch (err) {
        this.logger.warn(
          `Invite email failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    if (invite.customerPhone) {
      try {
        const result = await this.sms.sendTransactionalSms(
          invite.customerPhone,
          smsReservationInvite({
            outletName: outlet.name,
            bookUrl,
          }),
        );
        smsSent = result.sent;
      } catch (err) {
        this.logger.warn(
          `Invite SMS failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return {
      id: invite.id,
      token: invite.token,
      bookUrl,
      emailSent,
      smsSent,
      expiresAt: invite.expiresAt,
    };
  }

  async getPublicInvite(token: string) {
    const invite = await this.prisma.reservationInvite.findUnique({
      where: { token },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: { select: { id: true, name: true, slug: true, timezone: true } },
          },
        },
      },
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status === "cancelled") {
      throw new BadRequestException("This invitation was cancelled");
    }
    if (invite.status === "booked") {
      throw new BadRequestException("This invitation was already used");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.reservationInvite.update({
        where: { id: invite.id },
        data: { status: "expired" },
      });
      throw new BadRequestException("This invitation has expired");
    }

    return {
      token: invite.token,
      customerName: invite.customerName,
      customerPhone: invite.customerPhone,
      customerEmail: invite.customerEmail,
      expiresAt: invite.expiresAt,
      orgSlug: invite.outlet.organization.slug,
      outletSlug: invite.outlet.slug,
      outletName: invite.outlet.name,
      organizationName: invite.outlet.organization.name,
    };
  }

  async publicBook(body: {
    orgSlug?: string;
    outletSlug?: string;
    inviteToken?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    partySize: number;
    reservedAt: string;
    notes?: string;
  }) {
    if (body.partySize < 1) {
      throw new BadRequestException("partySize must be at least 1");
    }

    let organizationId: string;
    let outletId: string;
    let outletName: string;
    let orgSlug: string;
    let outletSlug: string;
    let timezone = "Asia/Kolkata";
    let inviteId: string | null = null;
    let customerName = body.customerName.trim();
    let customerPhone = body.customerPhone.trim();
    let customerEmail = body.customerEmail?.trim() || null;

    if (body.inviteToken) {
      const invite = await this.prisma.reservationInvite.findUnique({
        where: { token: body.inviteToken },
        include: {
          outlet: {
            include: {
              settings: true,
              organization: { select: { id: true, slug: true, timezone: true } },
            },
          },
        },
      });
      if (!invite) throw new NotFoundException("Invite not found");
      if (invite.status !== "sent" || invite.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException("Invite is not valid");
      }
      organizationId = invite.organizationId;
      outletId = invite.outletId;
      outletName = invite.outlet.name;
      orgSlug = invite.outlet.organization.slug;
      outletSlug = invite.outlet.slug;
      timezone = invite.outlet.organization.timezone || timezone;
      inviteId = invite.id;
      customerName = customerName || invite.customerName;
      customerPhone = customerPhone || invite.customerPhone;
      customerEmail = customerEmail || invite.customerEmail;

      const reservedAt = new Date(body.reservedAt);
      const slotSettings = readReservationSlotSettings(invite.outlet.settings?.settings);
      const openingHours = settingsRecord(invite.outlet.settings?.settings).openingHours;
      await this.assertSlotAvailable(
        outletId,
        reservedAt,
        body.partySize,
        timezone,
        openingHours,
        slotSettings,
      );

      const reservation = await this.prisma.reservation.create({
        data: {
          organizationId,
          outletId,
          customerName,
          customerPhone,
          customerEmail,
          partySize: body.partySize,
          reservedAt,
          notes: body.notes?.trim() || null,
          bookingToken: bookingToken(),
          status: "confirmed",
        },
      });

      await this.prisma.reservationInvite.update({
        where: { id: inviteId },
        data: { status: "booked", reservationId: reservation.id },
      });

      const notify = await this.notifyConfirmation({
        customerName,
        customerPhone,
        customerEmail,
        outletName,
        reservedAt: reservation.reservedAt,
        partySize: reservation.partySize,
      });

      return {
        id: reservation.id,
        bookingToken: reservation.bookingToken,
        status: reservation.status,
        reservedAt: reservation.reservedAt,
        outletName,
        orgSlug,
        outletSlug,
        ...notify,
      };
    }

    if (!body.orgSlug || !body.outletSlug) {
      throw new BadRequestException("orgSlug and outletSlug are required");
    }

    const { organization, outlet } = await this.storefront.resolveActiveOutlet(
      body.orgSlug,
      body.outletSlug,
    );
    const outletFull = await this.prisma.outlet.findFirst({
      where: { id: outlet.id },
      include: { settings: true },
    });
    organizationId = organization.id;
    outletId = outlet.id;
    outletName = outlet.name;
    orgSlug = organization.slug;
    outletSlug = outlet.slug;
    timezone = organization.timezone || timezone;

    const reservedAt = new Date(body.reservedAt);
    const slotSettings = readReservationSlotSettings(outletFull?.settings?.settings);
    const openingHours = settingsRecord(outletFull?.settings?.settings).openingHours;
    await this.assertSlotAvailable(
      outletId,
      reservedAt,
      body.partySize,
      timezone,
      openingHours,
      slotSettings,
    );

    const reservation = await this.prisma.reservation.create({
      data: {
        organizationId,
        outletId,
        customerName,
        customerPhone,
        customerEmail,
        partySize: body.partySize,
        reservedAt,
        notes: body.notes?.trim() || null,
        bookingToken: bookingToken(),
        status: "confirmed",
      },
    });

    const notify = await this.notifyConfirmation({
      customerName,
      customerPhone,
      customerEmail,
      outletName,
      reservedAt: reservation.reservedAt,
      partySize: reservation.partySize,
    });

    return {
      id: reservation.id,
      bookingToken: reservation.bookingToken,
      status: reservation.status,
      reservedAt: reservation.reservedAt,
      outletName,
      orgSlug,
      outletSlug,
      ...notify,
    };
  }
}

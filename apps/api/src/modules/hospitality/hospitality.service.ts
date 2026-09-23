import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BanquetStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConsentService } from '../privacy/consent.service';
import { GuestPrivacyService } from '../privacy/guest-privacy.service';
import { DPDP_PURPOSES } from '../privacy/privacy.constants';

export interface CreateGuestInput {
  name: string;
  phone?: string;
  email?: string;
  documentType?: string;
  documentNumber?: string;
}

export interface UpdateGuestInput {
  name?: string;
  phone?: string;
  email?: string;
  documentType?: string;
  documentNumber?: string;
}

export interface CreateRoomInput {
  outletId: string;
  roomTypeId: string;
  number: string;
  floor?: number;
}

export interface UpdateRoomInput {
  floor?: number;
  status?: RoomStatus | string;
}

export interface RoomPostingInput {
  roomId: string;
  guestId: string;
  amount: number;
  checkIn?: Date;
}

export interface CreateBanquetEventInput {
  banquetId: string;
  guestId: string;
  eventDate: Date;
  guestCount: number;
  total?: number;
}

@Injectable()
export class HospitalityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly consent: ConsentService,
    private readonly guestPrivacy: GuestPrivacyService,
  ) {}

  // --- Guests ---

  async findAllGuests(organizationId: string) {
    const guests = await this.prisma.guest.findMany({
      where: { organizationId, anonymizedAt: null },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return guests.map((g) => this.guestPrivacy.presentGuest(g, 'masked'));
  }

  async findGuest(id: string, organizationId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, organizationId, anonymizedAt: null },
      include: { roomPostings: true, banquetBookings: true },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    await this.audit.log({
      organizationId,
      action: 'guest_pii_read',
      entityType: 'Guest',
      entityId: id,
    });

    return this.guestPrivacy.presentGuest(guest, 'full');
  }

  async createGuest(
    organizationId: string,
    userId: string,
    input: CreateGuestInput,
  ) {
    const guest = await this.prisma.guest.create({
      data: {
        organizationId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        documentType: input.documentType,
        documentNumber: this.guestPrivacy.prepareDocumentForStorage(
          input.documentNumber,
        ),
      },
    });

    await this.consent.record({
      organizationId,
      subjectType: 'guest',
      subjectId: guest.id,
      purpose: DPDP_PURPOSES.SERVICE,
      granted: true,
      source: 'hospitality_checkin',
      actorUserId: userId,
    });

    if (input.documentNumber?.trim()) {
      await this.consent.record({
        organizationId,
        subjectType: 'guest',
        subjectId: guest.id,
        purpose: DPDP_PURPOSES.HOSPITALITY_ID,
        granted: true,
        source: 'hospitality_checkin',
        actorUserId: userId,
      });
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'GUEST_CREATED',
      entityType: 'Guest',
      entityId: guest.id,
    });

    return this.guestPrivacy.presentGuest(guest, 'full');
  }

  async updateGuest(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateGuestInput,
  ) {
    await this.findGuest(id, organizationId);
    const guest = await this.prisma.guest.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.documentType !== undefined
          ? { documentType: input.documentType }
          : {}),
        ...(input.documentNumber !== undefined
          ? {
              documentNumber: this.guestPrivacy.prepareDocumentForStorage(
                input.documentNumber,
              ),
            }
          : {}),
      },
    });

    if (input.documentNumber?.trim()) {
      await this.consent.record({
        organizationId,
        subjectType: 'guest',
        subjectId: id,
        purpose: DPDP_PURPOSES.HOSPITALITY_ID,
        granted: true,
        source: 'hospitality_update',
        actorUserId: userId,
      });
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'GUEST_UPDATED',
      entityType: 'Guest',
      entityId: id,
    });

    return this.guestPrivacy.presentGuest(guest, 'full');
  }

  async checkOutGuest(id: string, organizationId: string, userId: string) {
    await this.findGuest(id, organizationId);

    const openPostings = await this.prisma.roomPosting.findMany({
      where: { guestId: id, checkOut: null },
    });

    if (openPostings.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.roomPosting.updateMany({
          where: { guestId: id, checkOut: null },
          data: { checkOut: new Date() },
        });
        await tx.room.updateMany({
          where: { id: { in: openPostings.map((p) => p.roomId) } },
          data: { status: RoomStatus.available },
        });
      });
    }

    await this.audit.log({
      organizationId,
      userId,
      action: 'GUEST_CHECKED_OUT',
      entityType: 'Guest',
      entityId: id,
    });

    return this.findGuest(id, organizationId);
  }

  // --- Rooms ---

  async findAllRooms(outletId: string, organizationId: string) {
    return this.prisma.room.findMany({
      where: {
        ...(outletId ? { outletId } : {}),
        outlet: { organizationId },
      },
      include: { roomType: true },
      orderBy: { number: 'asc' },
      take: 200,
    });
  }

  async createRoom(
    organizationId: string,
    userId: string,
    input: CreateRoomInput,
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: input.outletId, organizationId },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: input.roomTypeId },
    });
    if (!roomType) throw new NotFoundException('Room type not found');

    const room = await this.prisma.room.create({
      data: {
        outletId: input.outletId,
        roomTypeId: input.roomTypeId,
        number: input.number,
        floor: input.floor,
      },
      include: { roomType: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ROOM_CREATED',
      entityType: 'Room',
      entityId: room.id,
      metadata: { outletId: input.outletId },
    });

    return room;
  }

  async updateRoom(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateRoomInput,
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id, outlet: { organizationId } },
    });
    if (!room) throw new NotFoundException('Room not found');

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        ...(input.floor !== undefined ? { floor: input.floor } : {}),
        ...(input.status
          ? { status: input.status as RoomStatus }
          : {}),
      },
      include: { roomType: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ROOM_UPDATED',
      entityType: 'Room',
      entityId: id,
      metadata: { outletId: room.outletId },
    });

    return updated;
  }

  // --- Room Posting ---

  async postToRoom(
    organizationId: string,
    userId: string,
    input: RoomPostingInput,
  ) {
    const guest = await this.prisma.guest.findFirst({
      where: { id: input.guestId, organizationId },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const room = await this.prisma.room.findFirst({
      where: { id: input.roomId, outlet: { organizationId } },
    });
    if (!room) throw new NotFoundException('Room not found');

    const open = await this.prisma.roomPosting.findFirst({
      where: { roomId: input.roomId, checkOut: null },
    });
    if (open) {
      throw new BadRequestException('Room already has an open posting');
    }

    const posting = await this.prisma.$transaction(async (tx) => {
      const created = await tx.roomPosting.create({
        data: {
          roomId: input.roomId,
          guestId: input.guestId,
          amount: input.amount,
          checkIn: input.checkIn ?? new Date(),
        },
      });

      await tx.room.update({
        where: { id: input.roomId },
        data: { status: RoomStatus.occupied },
      });

      return created;
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ROOM_POSTING_CREATED',
      entityType: 'RoomPosting',
      entityId: posting.id,
      metadata: { roomId: input.roomId, amount: input.amount },
    });

    return posting;
  }

  async settleRoomPosting(
    id: string,
    organizationId: string,
    userId: string,
  ) {
    const posting = await this.prisma.roomPosting.findUnique({
      where: { id },
      include: { room: { include: { outlet: true } }, guest: true },
    });
    if (
      !posting ||
      posting.room.outlet.organizationId !== organizationId ||
      posting.guest.organizationId !== organizationId
    ) {
      throw new NotFoundException('Room posting not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const settled = await tx.roomPosting.update({
        where: { id },
        data: { checkOut: new Date() },
      });
      await tx.room.update({
        where: { id: posting.roomId },
        data: { status: RoomStatus.available },
      });
      return settled;
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ROOM_POSTING_SETTLED',
      entityType: 'RoomPosting',
      entityId: id,
      metadata: { outletId: posting.room.outletId },
    });

    return updated;
  }

  // --- Banquet Events (bookings) ---

  async findBanquetEvents(organizationId: string, banquetId?: string) {
    return this.prisma.banquetBooking.findMany({
      where: {
        banquet: { organizationId },
        ...(banquetId ? { banquetId } : {}),
      },
      include: { banquet: true, guest: true },
      orderBy: { eventDate: 'asc' },
      take: 200,
    });
  }

  async createBanquetEvent(
    organizationId: string,
    userId: string,
    input: CreateBanquetEventInput,
  ) {
    const banquet = await this.prisma.banquet.findFirst({
      where: { id: input.banquetId, organizationId },
    });
    if (!banquet) throw new NotFoundException('Banquet not found');

    const guest = await this.prisma.guest.findFirst({
      where: { id: input.guestId, organizationId },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const event = await this.prisma.banquetBooking.create({
      data: {
        banquetId: input.banquetId,
        guestId: input.guestId,
        eventDate: input.eventDate,
        guestCount: input.guestCount,
        total: input.total ?? 0,
      },
      include: { banquet: true, guest: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'BANQUET_EVENT_CREATED',
      entityType: 'BanquetBooking',
      entityId: event.id,
    });

    return event;
  }

  async updateBanquetEventStatus(
    id: string,
    organizationId: string,
    userId: string,
    status: string,
  ) {
    const event = await this.prisma.banquetBooking.findFirst({
      where: { id, banquet: { organizationId } },
    });
    if (!event) throw new NotFoundException('Banquet event not found');

    const updated = await this.prisma.banquetBooking.update({
      where: { id },
      data: { status: status as BanquetStatus },
      include: { banquet: true, guest: true },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'BANQUET_EVENT_UPDATED',
      entityType: 'BanquetBooking',
      entityId: id,
      metadata: { status },
    });

    return updated;
  }
}

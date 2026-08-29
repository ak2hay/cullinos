import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateGuestInput {
  name: string;
  phone?: string;
  email?: string;
  roomNumber?: string;
  checkInAt?: Date;
  notes?: string;
}

export interface UpdateGuestInput {
  name?: string;
  phone?: string;
  email?: string;
  roomNumber?: string;
  checkInAt?: Date;
  checkOutAt?: Date;
  notes?: string;
}

export interface CreateRoomInput {
  outletId: string;
  number: string;
  floor?: string;
  type?: string;
}

export interface UpdateRoomInput {
  floor?: string;
  type?: string;
  status?: string;
  isActive?: boolean;
}

export interface RoomPostingInput {
  orderId: string;
  roomId: string;
  amount: number;
}

export interface CreateBanquetEventInput {
  outletId: string;
  name: string;
  eventDate: Date;
  guestCount: number;
  notes?: string;
}

@Injectable()
export class HospitalityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Guests ---

  async findAllGuests(organizationId: string) {
    return this.prisma.client.guest.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findGuest(id: string, organizationId: string) {
    const guest = await this.prisma.client.guest.findFirst({
      where: { id, organizationId },
    });
    if (!guest) throw new NotFoundException('Guest not found');
    return guest;
  }

  async createGuest(
    organizationId: string,
    userId: string,
    input: CreateGuestInput,
  ) {
    const guest = await this.prisma.client.guest.create({
      data: { organizationId, ...input },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'GUEST_CREATED',
      entityType: 'Guest',
      entityId: guest.id,
    });

    return guest;
  }

  async updateGuest(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateGuestInput,
  ) {
    await this.findGuest(id, organizationId);
    const guest = await this.prisma.client.guest.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'GUEST_UPDATED',
      entityType: 'Guest',
      entityId: id,
    });

    return guest;
  }

  async checkOutGuest(id: string, organizationId: string, userId: string) {
    await this.findGuest(id, organizationId);
    const guest = await this.prisma.client.guest.update({
      where: { id },
      data: { checkOutAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'GUEST_CHECKED_OUT',
      entityType: 'Guest',
      entityId: id,
    });

    return guest;
  }

  // --- Rooms ---

  async findAllRooms(outletId: string) {
    return this.prisma.client.room.findMany({
      where: { outletId },
      orderBy: { number: 'asc' },
    });
  }

  async createRoom(
    organizationId: string,
    userId: string,
    input: CreateRoomInput,
  ) {
    const room = await this.prisma.client.room.create({
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'ROOM_CREATED',
      entityType: 'Room',
      entityId: room.id,
    });

    return room;
  }

  async updateRoom(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateRoomInput,
  ) {
    const room = await this.prisma.client.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');

    const updated = await this.prisma.client.room.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: room.outletId,
      action: 'ROOM_UPDATED',
      entityType: 'Room',
      entityId: id,
    });

    return updated;
  }

  // --- Room Posting ---

  async postToRoom(
    organizationId: string,
    userId: string,
    input: RoomPostingInput,
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: input.orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const room = await this.prisma.client.room.findUnique({
      where: { id: input.roomId },
    });
    if (!room) throw new NotFoundException('Room not found');

    const existing = await this.prisma.client.roomPosting.findUnique({
      where: { orderId: input.orderId },
    });
    if (existing) {
      throw new BadRequestException('Order already posted to a room');
    }

    const posting = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.roomPosting.create({
        data: {
          orderId: input.orderId,
          roomId: input.roomId,
          amount: input.amount,
          status: 'POSTED',
        },
      });

      await tx.order.update({
        where: { id: input.orderId },
        data: { roomId: input.roomId, guestId: order.guestId },
      });

      await tx.room.update({
        where: { id: input.roomId },
        data: { status: 'OCCUPIED' },
      });

      return created;
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'ROOM_POSTING_CREATED',
      entityType: 'RoomPosting',
      entityId: posting.id,
      newValue: { roomId: input.roomId, amount: input.amount },
    });

    return posting;
  }

  async settleRoomPosting(
    id: string,
    organizationId: string,
    userId: string,
  ) {
    const posting = await this.prisma.client.roomPosting.findUnique({
      where: { id },
      include: { order: true, room: true },
    });
    if (!posting || posting.order.organizationId !== organizationId) {
      throw new NotFoundException('Room posting not found');
    }

    const updated = await this.prisma.client.roomPosting.update({
      where: { id },
      data: { status: 'SETTLED', settledAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: posting.order.outletId,
      action: 'ROOM_POSTING_SETTLED',
      entityType: 'RoomPosting',
      entityId: id,
    });

    return updated;
  }

  // --- Banquet Events ---

  async findBanquetEvents(outletId: string) {
    return this.prisma.client.banquetEvent.findMany({
      where: { outletId },
      orderBy: { eventDate: 'asc' },
    });
  }

  async createBanquetEvent(
    organizationId: string,
    userId: string,
    input: CreateBanquetEventInput,
  ) {
    const event = await this.prisma.client.banquetEvent.create({
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'BANQUET_EVENT_CREATED',
      entityType: 'BanquetEvent',
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
    const event = await this.prisma.client.banquetEvent.findUnique({
      where: { id },
    });
    if (!event) throw new NotFoundException('Banquet event not found');

    const updated = await this.prisma.client.banquetEvent.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: event.outletId,
      action: 'BANQUET_EVENT_UPDATED',
      entityType: 'BanquetEvent',
      entityId: id,
      newValue: { status },
    });

    return updated;
  }
}

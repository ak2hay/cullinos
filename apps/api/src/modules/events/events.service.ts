import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { pickDefined } from "../../common/pick.util";

const UPDATABLE_EVENT_FIELDS = [
  "name",
  "location",
  "address",
  "latitude",
  "longitude",
  "startTime",
  "endTime",
  "maxPreOrders",
  "notes",
  "isActive",
] as const;

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, outletId?: string) {
    return this.prisma.outletEvent.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
        isActive: true,
      },
      orderBy: { eventDate: "asc" },
      take: 200,
    });
  }

  /** Public listing: only events whose organization owns the outlet. */
  async listPublicByOutlet(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { organizationId: true },
    });
    if (!outlet) return [];
    return this.list(outlet.organizationId, outletId);
  }

  async get(orgId: string, id: string) {
    const event = await this.prisma.outletEvent.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  async create(
    orgId: string,
    data: {
      outletId: string;
      name: string;
      location?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      eventDate: string;
      startTime: string;
      endTime: string;
      preOrderOpensAt?: string;
      preOrderClosesAt?: string;
      maxPreOrders?: number;
      notes?: string;
    },
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: data.outletId, organizationId: orgId },
      select: { id: true },
    });
    if (!outlet) throw new BadRequestException("Invalid outletId");
    return this.prisma.outletEvent.create({
      data: {
        organizationId: orgId,
        outletId: data.outletId,
        name: data.name,
        location: data.location,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        eventDate: new Date(data.eventDate),
        startTime: data.startTime,
        endTime: data.endTime,
        preOrderOpensAt: data.preOrderOpensAt ? new Date(data.preOrderOpensAt) : undefined,
        preOrderClosesAt: data.preOrderClosesAt ? new Date(data.preOrderClosesAt) : undefined,
        maxPreOrders: data.maxPreOrders,
        notes: data.notes,
      },
    });
  }

  async update(orgId: string, id: string, data: Record<string, unknown>) {
    await this.get(orgId, id);
    const update: Record<string, unknown> = pickDefined(data, UPDATABLE_EVENT_FIELDS);
    if (data.eventDate) update.eventDate = new Date(data.eventDate as string);
    if (data.preOrderOpensAt) update.preOrderOpensAt = new Date(data.preOrderOpensAt as string);
    if (data.preOrderClosesAt) update.preOrderClosesAt = new Date(data.preOrderClosesAt as string);
    return this.prisma.outletEvent.update({ where: { id }, data: update });
  }

  async delete(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.outletEvent.delete({ where: { id } });
  }
}

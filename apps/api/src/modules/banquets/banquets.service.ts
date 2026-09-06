import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BanquetsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.banquet.findMany({
      where: { organizationId: orgId },
      take: 200,
      orderBy: { name: "asc" },
      include: { _count: { select: { bookings: true } } },
    });
  }

  async createPackage(
    orgId: string,
    data: { name: string; capacity?: number; baseRate?: number },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException("name is required");
    }
    return this.prisma.banquet.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        capacity: data.capacity ?? 50,
        baseRate: data.baseRate ?? 0,
      },
    });
  }

  async get(orgId: string, id: string) {
    const banquet = await this.prisma.banquet.findFirst({
      where: { id, organizationId: orgId },
      include: { bookings: { include: { guest: true }, take: 50 } },
    });
    if (!banquet) throw new NotFoundException("Banquet package not found");
    return banquet;
  }

  listBookings(orgId: string) {
    return this.prisma.banquetBooking.findMany({
      where: { banquet: { organizationId: orgId } },
      include: {
        banquet: { select: { id: true, name: true, capacity: true } },
        guest: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { eventDate: "desc" },
      take: 200,
    });
  }

  async createBooking(
    orgId: string,
    data: {
      banquetId: string;
      guestId?: string;
      guestName?: string;
      guestPhone?: string;
      guestEmail?: string;
      eventDate: string;
      guestCount?: number;
      total?: number;
      status?: string;
    },
  ) {
    const banquet = await this.prisma.banquet.findFirst({
      where: { id: data.banquetId, organizationId: orgId },
    });
    if (!banquet) throw new BadRequestException("Invalid banquet package");
    if (!data.eventDate) throw new BadRequestException("eventDate is required");

    let guestId = data.guestId;
    if (guestId) {
      const guest = await this.prisma.guest.findFirst({
        where: { id: guestId, organizationId: orgId },
      });
      if (!guest) throw new BadRequestException("Invalid guest");
    } else {
      const name = data.guestName?.trim();
      if (!name) throw new BadRequestException("guestId or guestName is required");
      const guest = await this.prisma.guest.create({
        data: {
          organizationId: orgId,
          name,
          phone: data.guestPhone,
          email: data.guestEmail,
        },
      });
      guestId = guest.id;
    }

    return this.prisma.banquetBooking.create({
      data: {
        banquetId: data.banquetId,
        guestId,
        eventDate: new Date(data.eventDate),
        guestCount: data.guestCount ?? 1,
        total: data.total ?? banquet.baseRate,
        status: (data.status as never) ?? "inquiry",
      },
      include: {
        banquet: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true, phone: true } },
      },
    });
  }
}

import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { BanquetsService } from "./banquets.service";

@Controller("banquets")
export class BanquetsController {
  constructor(private service: BanquetsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  createPackage(
    @OrgId() orgId: string,
    @Body() body: { name: string; capacity?: number; baseRate?: number },
  ) {
    return this.service.createPackage(orgId, body);
  }

  @Get("bookings")
  listBookings(@OrgId() orgId: string) {
    return this.service.listBookings(orgId);
  }

  @Post("bookings")
  createBooking(
    @OrgId() orgId: string,
    @Body()
    body: {
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
    return this.service.createBooking(orgId, body);
  }

  @Get(":id")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }
}

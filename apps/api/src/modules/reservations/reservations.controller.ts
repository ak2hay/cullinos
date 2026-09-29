import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { assertTurnstile } from "../../common/turnstile.util";
import { clientIp } from "../../common/client-ip.util";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ReservationsService } from "./reservations.service";

@Controller("reservations")
@RequirePermissions("table:manage")
export class ReservationsController {
  constructor(private service: ReservationsService) {}

  @Get()
  @RequireModule("tables")
  @RequirePermissions("table:read")
  list(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.list(orgId, { outletId, from, to });
  }

  @Get("book-link")
  @RequireModule("tables")
  @RequirePermissions("table:read")
  bookLink(
    @Query("orgSlug") orgSlug: string,
    @Query("outletSlug") outletSlug: string,
  ) {
    return {
      url: this.service.getPublicBookLink(orgSlug, outletSlug),
    };
  }

  @Get("slots")
  @RequireModule("tables")
  @RequirePermissions("table:read")
  slots(
    @OrgId() orgId: string,
    @Query("outletId") outletId: string,
    @Query("date") date: string,
    @Query("partySize") partySize?: string,
  ) {
    return this.service.listSlotsForOutlet(
      orgId,
      outletId,
      date,
      partySize ? Number(partySize) : 1,
    );
  }

  @Get("settings")
  @RequireModule("tables")
  @RequirePermissions("table:read")
  getSettings(@OrgId() orgId: string, @Query("outletId") outletId: string) {
    return this.service.getReservationSettings(orgId, outletId);
  }

  @Put("settings")
  @RequireModule("tables")
  @RequirePermissions("settings:update")
  putSettings(
    @OrgId() orgId: string,
    @Body()
    body: {
      outletId: string;
      reservationSlotMinutes?: number;
      reservationMaxCoversPerSlot?: number;
    },
  ) {
    return this.service.updateReservationSettings(orgId, body.outletId, body);
  }

  @Post("invites")
  @RequireModule("tables")
  createInvite(
    @OrgId() orgId: string,
    @Body()
    body: {
      outletId: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      expiresInDays?: number;
    },
  ) {
    return this.service.createInvite(orgId, body);
  }

  @Get(":id")
  @RequireModule("tables")
  @RequirePermissions("table:read")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequireModule("tables")
  create(
    @OrgId() orgId: string,
    @Body()
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
    },
  ) {
    return this.service.create(orgId, body);
  }

  @Patch(":id")
  @RequireModule("tables")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body()
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
    return this.service.update(orgId, id, body);
  }

  @Delete(":id")
  @RequireModule("tables")
  remove(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.remove(orgId, id);
  }
}

@Controller("public/reservations")
export class PublicReservationsController {
  constructor(private service: ReservationsService) {}

  @Public()
  @Get("slots")
  slots(
    @Query("orgSlug") orgSlug: string,
    @Query("outletSlug") outletSlug: string,
    @Query("date") date: string,
    @Query("partySize") partySize?: string,
  ) {
    return this.service.publicSlots({
      orgSlug,
      outletSlug,
      date,
      partySize: partySize ? Number(partySize) : 1,
    });
  }

  @Public()
  @Get("invite/:token")
  invite(@Param("token") token: string) {
    return this.service.getPublicInvite(token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  async book(
    @Body()
    body: {
      orgSlug?: string;
      outletSlug?: string;
      inviteToken?: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      partySize: number;
      reservedAt: string;
      notes?: string;
      captchaToken?: string;
    },
    @Req() req: Request,
  ) {
    await assertTurnstile(body.captchaToken, clientIp(req));
    const { captchaToken: _captcha, ...booking } = body;
    return this.service.publicBook(booking);
  }
}

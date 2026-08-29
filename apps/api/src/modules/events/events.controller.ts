import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { EventsService } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(private service: EventsService) {}

  @Get()
  @RequireModule("events")
  list(@OrgId() orgId: string, @Query("outletId") outletId?: string) {
    return this.service.list(orgId, outletId);
  }

  @Get(":id")
  @RequireModule("events")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequireModule("events")
  create(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.create(orgId, body as never);
  }

  @Patch(":id")
  @RequireModule("events")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(orgId, id, body);
  }

  @Delete(":id")
  @RequireModule("events")
  delete(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.delete(orgId, id);
  }
}

@Controller("public/events")
export class PublicEventsController {
  constructor(private service: EventsService) {}

  @Public()
  @Get("outlets/:outletId")
  listByOutlet(@Param("outletId") outletId: string) {
    return this.service.list("", outletId);
  }
}
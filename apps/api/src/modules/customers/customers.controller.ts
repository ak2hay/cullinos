import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId } from "../../common/decorators";
import { CustomersService } from "./customers.service";

@Controller("customers")
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get()
  list(@OrgId() orgId: string, @Query("q") q?: string) {
    return this.service.list(orgId, q);
  }

  @Get(":id")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.create(orgId, body as never, user.sub);
  }

  @Patch(":id")
  update(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(orgId, id, body as never, user.sub);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { CentralKitchenService } from "./central-kitchen.service";

@Controller("central-kitchen")
export class CentralKitchenController {
  constructor(private service: CentralKitchenService) {}

  @Get()
  @RequireModule("management")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("indents")
  @RequireModule("management")
  listIndents(
    @OrgId() orgId: string,
    @Query("centralKitchenId") centralKitchenId?: string,
  ) {
    return this.service.listIndents(orgId, centralKitchenId);
  }

  @Post("indents/plan-routes")
  @RequireModule("management")
  planRoutes(
    @OrgId() orgId: string,
    @Body() body: { centralKitchenId?: string },
  ) {
    return this.service.planRoutes(orgId, body?.centralKitchenId);
  }

  @Get(":id")
  @RequireModule("management")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequireModule("management")
  create(
    @OrgId() orgId: string,
    @Body()
    body: { outletId: string; name: string; linkedOutletIds?: string[] },
  ) {
    return this.service.create(orgId, body);
  }

  @Patch(":id/links")
  @RequireModule("management")
  updateLinks(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: { linkedOutletIds: string[] },
  ) {
    return this.service.updateLinks(orgId, id, body.linkedOutletIds ?? []);
  }

  @Post("indents")
  @RequireModule("management")
  createIndent(
    @OrgId() orgId: string,
    @Body()
    body: {
      centralKitchenId: string;
      requestingOutletId: string;
      notes?: string;
      items: Array<{ inventoryItemId: string; quantity: number }>;
    },
  ) {
    return this.service.createIndent(orgId, body);
  }

  @Post("indents/:id/fulfill")
  @RequireModule("management")
  fulfillIndent(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.fulfillIndent(orgId, id);
  }
}

import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { TablesService } from "./tables.service";

@Controller("tables")
export class TablesController {
  constructor(private service: TablesService) {}

  @Get("outlets/:outletId")
  @RequireModule("tables")
  listByOutlet(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.listByOutlet(orgId, outletId);
  }

  @Patch("outlets/:outletId/:tableId/status")
  @RequireModule("tables")
  updateStatus(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("tableId") tableId: string,
    @Body("status") status: string,
  ) {
    return this.service.updateStatus(orgId, outletId, tableId, status);
  }
}

@Controller("public/tables")
export class PublicTablesController {
  constructor(private service: TablesService) {}

  @Public()
  @Get("outlets/:outletId")
  list(@Param("outletId") outletId: string) {
    return this.service.listByOutletPublic(outletId);
  }
}

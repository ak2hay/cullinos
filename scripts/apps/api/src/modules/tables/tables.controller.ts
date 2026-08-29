import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { TablesService } from "./tables.service";

@Controller("tables")
export class TablesController {
  constructor(private service: TablesService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

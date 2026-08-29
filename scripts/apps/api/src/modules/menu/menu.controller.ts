import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { MenuService } from "./menu.service";

@Controller("menu")
export class MenuController {
  constructor(private service: MenuService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

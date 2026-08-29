import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { BanquetsService } from "./banquets.service";

@Controller("banquets")
export class BanquetsController {
  constructor(private service: BanquetsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

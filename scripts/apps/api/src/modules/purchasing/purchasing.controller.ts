import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { PurchasingService } from "./purchasing.service";

@Controller("purchasing")
export class PurchasingController {
  constructor(private service: PurchasingService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

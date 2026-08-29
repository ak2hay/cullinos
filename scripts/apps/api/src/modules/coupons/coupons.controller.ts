import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { CouponsService } from "./coupons.service";

@Controller("coupons")
export class CouponsController {
  constructor(private service: CouponsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

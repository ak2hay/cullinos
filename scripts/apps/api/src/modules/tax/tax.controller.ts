import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { TaxService } from "./tax.service";

@Controller("tax")
export class TaxController {
  constructor(private service: TaxService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

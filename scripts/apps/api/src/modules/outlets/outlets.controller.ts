import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { OutletsService } from "./outlets.service";

@Controller("outlets")
export class OutletsController {
  constructor(private service: OutletsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

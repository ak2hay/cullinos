import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { KotService } from "./kot.service";

@Controller("kot")
export class KotController {
  constructor(private service: KotService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

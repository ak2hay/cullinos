import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { WastageService } from "./wastage.service";

@Controller("wastage")
export class WastageController {
  constructor(private service: WastageService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

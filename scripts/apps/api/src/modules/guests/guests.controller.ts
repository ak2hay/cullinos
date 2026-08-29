import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { GuestsService } from "./guests.service";

@Controller("guests")
export class GuestsController {
  constructor(private service: GuestsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

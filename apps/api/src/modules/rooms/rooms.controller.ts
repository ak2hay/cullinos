import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
export class RoomsController {
  constructor(private service: RoomsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { PosService } from "./pos.service";

@Controller("pos")
export class PosController {
  constructor(private service: PosService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

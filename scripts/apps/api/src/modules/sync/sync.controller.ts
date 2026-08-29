import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private service: SyncService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

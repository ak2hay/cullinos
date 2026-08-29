import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { FranchiseService } from "./franchise.service";

@Controller("franchise")
export class FranchiseController {
  constructor(private service: FranchiseService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

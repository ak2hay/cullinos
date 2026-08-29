import { Controller, Get } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { FranchiseService } from "./franchise.service";

@Controller("franchise")
export class FranchiseController {
  constructor(private service: FranchiseService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("franchisees")
  @RequireModule("franchise")
  listFranchisees(@OrgId() orgId: string) {
    return this.service.listFranchisees(orgId);
  }
}

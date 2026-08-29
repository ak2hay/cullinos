import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { BrandsService } from "./brands.service";

@Controller("brands")
export class BrandsController {
  constructor(private service: BrandsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

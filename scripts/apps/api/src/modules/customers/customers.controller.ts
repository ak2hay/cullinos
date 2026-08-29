import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { CustomersService } from "./customers.service";

@Controller("customers")
export class CustomersController {
  constructor(private service: CustomersService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private service: PaymentsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}

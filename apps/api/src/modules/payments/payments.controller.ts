import { Body, Controller, Get, Post } from "@nestjs/common";
import { OrgId, Public, RequireModule } from "../../common/decorators";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post("online/intent")
  @RequireModule("billing")
  createIntent(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createOnlineIntent(orgId, body as never);
  }

  @Post("online/confirm")
  @Public()
  confirm(
    @Body("organizationId") orgId: string,
    @Body("orderId") orderId: string,
    @Body("paymentRef") paymentRef: string,
  ) {
    return this.service.confirmOnlinePayment(orgId, orderId, paymentRef);
  }
}

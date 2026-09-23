import { Module, forwardRef } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomerAuthController } from "./customer-auth.controller";
import { CustomersService } from "./customers.service";
import { SmsModule } from "../sms/sms.module";
import { PrivacyModule } from "../privacy/privacy.module";

@Module({
  imports: [SmsModule, forwardRef(() => PrivacyModule)],
  controllers: [CustomersController, CustomerAuthController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}

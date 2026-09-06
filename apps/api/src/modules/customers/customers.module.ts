import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomerAuthController } from "./customer-auth.controller";
import { CustomersService } from "./customers.service";
import { SmsModule } from "../sms/sms.module";

@Module({
  imports: [SmsModule],
  controllers: [CustomersController, CustomerAuthController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}

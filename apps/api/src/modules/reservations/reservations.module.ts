import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { SmsModule } from "../sms/sms.module";
import { StorefrontModule } from "../storefront/storefront.module";
import {
  PublicReservationsController,
  ReservationsController,
} from "./reservations.controller";
import { ReservationsService } from "./reservations.service";

@Module({
  imports: [StorefrontModule, MailModule, SmsModule],
  controllers: [ReservationsController, PublicReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}

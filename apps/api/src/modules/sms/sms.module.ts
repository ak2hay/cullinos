import { Module } from "@nestjs/common";
import { Msg91Service } from "./msg91.service";
import { WhatsappService } from "./whatsapp.service";

@Module({
  providers: [Msg91Service, WhatsappService],
  exports: [Msg91Service, WhatsappService],
})
export class SmsModule {}

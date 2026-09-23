import { Module } from "@nestjs/common";
import { ConsentService } from "./consent.service";
import { CustomerPrivacyService } from "./customer-privacy.service";
import { GuestPrivacyService } from "./guest-privacy.service";
import { PrivacyController } from "./privacy.controller";
import { PrivacyRetentionService } from "./privacy-retention.service";

@Module({
  controllers: [PrivacyController],
  providers: [
    ConsentService,
    CustomerPrivacyService,
    GuestPrivacyService,
    PrivacyRetentionService,
  ],
  exports: [
    ConsentService,
    CustomerPrivacyService,
    GuestPrivacyService,
    PrivacyRetentionService,
  ],
})
export class PrivacyModule {}

import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { PlatformSupportController } from "./platform-support.controller";
import { PlatformSupportService } from "./platform-support.service";
import { TenantSupportController } from "./tenant-support.controller";
import { TenantSupportService } from "./tenant-support.service";

/** Support desk tickets, ticket-backed tenant access grants and the restaurant support portal. */
@Module({
  imports: [MailModule],
  controllers: [PlatformSupportController, TenantSupportController],
  providers: [PlatformSupportService, TenantSupportService],
  exports: [PlatformSupportService],
})
export class PlatformSupportModule {}

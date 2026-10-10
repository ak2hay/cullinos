import { Module } from "@nestjs/common";
import { PlatformSupportController } from "./platform-support.controller";
import { PlatformSupportService } from "./platform-support.service";

/** Support desk tickets and ticket-backed tenant access grants. */
@Module({
  controllers: [PlatformSupportController],
  providers: [PlatformSupportService],
  exports: [PlatformSupportService],
})
export class PlatformSupportModule {}

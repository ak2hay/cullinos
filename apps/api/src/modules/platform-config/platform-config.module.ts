import { Global, Module } from "@nestjs/common";
import { PlatformConfigService } from "./platform-config.service";
import { PortalStatusController } from "./portal-status.controller";
import { PortalStatusService } from "./portal-status.service";

@Global()
@Module({
  controllers: [PortalStatusController],
  providers: [PlatformConfigService, PortalStatusService],
  exports: [PlatformConfigService, PortalStatusService],
})
export class PlatformConfigModule {}

import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlatformSecurityController } from "./platform-security.controller";
import { PlatformSecurityService } from "./platform-security.service";

/** Access review campaigns, staff session management and just-in-time elevation. */
@Module({
  imports: [AuthModule],
  controllers: [PlatformSecurityController],
  providers: [PlatformSecurityService],
})
export class PlatformSecurityModule {}

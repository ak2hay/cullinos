import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SuperAdminModule } from "../super-admin/super-admin.module";
import { PlatformReportsController } from "./platform-reports.controller";
import { PlatformReportsService } from "./platform-reports.service";

/** Ops overview, saved views, approval-gated exports and bulk tenant jobs. */
@Module({
  imports: [AuthModule, SuperAdminModule],
  controllers: [PlatformReportsController],
  providers: [PlatformReportsService],
})
export class PlatformReportsModule {}

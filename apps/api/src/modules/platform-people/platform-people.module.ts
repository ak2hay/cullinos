import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SuperAdminModule } from "../super-admin/super-admin.module";
import { PlatformPeopleController } from "./platform-people.controller";
import { PlatformPeopleService } from "./platform-people.service";

/** Employee directory, lifecycle workflows, shifts and on-call rotations. */
@Module({
  imports: [AuthModule, SuperAdminModule],
  controllers: [PlatformPeopleController],
  providers: [PlatformPeopleService],
})
export class PlatformPeopleModule {}

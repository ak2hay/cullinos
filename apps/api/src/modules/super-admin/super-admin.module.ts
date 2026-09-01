import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { PlanBootstrapService } from "./plan-bootstrap.service";
import { SuperAdminController } from "./super-admin.controller";
import { SuperAdminService } from "./super-admin.service";

@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminGuard, PlanBootstrapService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}

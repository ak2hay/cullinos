import { Module } from "@nestjs/common";
import { MarketingModule } from "../marketing/marketing.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrgRolesService } from "./org-roles.service";
import { TenantProvisioningService } from "./tenant-provisioning.service";

@Module({
  imports: [MarketingModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgRolesService, TenantProvisioningService],
  exports: [OrganizationsService, OrgRolesService, TenantProvisioningService],
})
export class OrganizationsModule {}

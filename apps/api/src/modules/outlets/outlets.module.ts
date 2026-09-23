import { Module } from "@nestjs/common";
import { OutletsController } from "./outlets.controller";
import { OutletsService } from "./outlets.service";
import { OutletAccessService } from "./outlet-access.service";
import { MarketingModule } from "../marketing/marketing.module";
import { OrganizationsModule } from "../organizations/organizations.module";

@Module({
  imports: [MarketingModule, OrganizationsModule],
  controllers: [OutletsController],
  providers: [OutletsService, OutletAccessService],
  exports: [OutletsService, OutletAccessService],
})
export class OutletsModule {}

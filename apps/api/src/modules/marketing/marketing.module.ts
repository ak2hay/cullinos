import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { MarketingSuperAdminController } from "./marketing-super-admin.controller";
import { MarketingPublicController } from "./marketing-public.controller";
import { MarketingService } from "./marketing.service";
import { MarketingUploadService } from "./marketing-upload.service";
import { SuperAdminGuard } from "./guards/super-admin.guard";

@Module({
  imports: [PrismaModule],
  controllers: [MarketingSuperAdminController, MarketingPublicController],
  providers: [MarketingService, MarketingUploadService, SuperAdminGuard],
  exports: [MarketingService],
})
export class MarketingModule {}

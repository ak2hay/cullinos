import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CurrentUser, OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtPayload } from "@cullinos/auth";
import {
  MARKETING_UPLOAD_MAX_BYTES,
  MarketingUploadService,
  uploadMaxBytesFor,
} from "../marketing/marketing-upload.service";
import {
  GuestMarketingService,
  type BannerInput,
} from "./guest-marketing.service";

@Controller("guest-marketing")
export class GuestMarketingAdminController {
  constructor(
    private service: GuestMarketingService,
    private uploadService: MarketingUploadService,
  ) {}

  @Get("banners")
  @RequirePermissions("settings:read", "org:read")
  listBanners(@OrgId() orgId: string) {
    return this.service.listOrgBanners(orgId);
  }

  @Post("banners")
  @RequirePermissions("settings:update", "org:update", "org:manage_settings")
  createBanner(@OrgId() orgId: string, @Body() body: BannerInput) {
    return this.service.createBanner("organization", orgId, body);
  }

  @Patch("banners/:id")
  @RequirePermissions("settings:update", "org:update", "org:manage_settings")
  updateBanner(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: BannerInput,
  ) {
    return this.service.updateBanner(id, body, { orgId });
  }

  @Delete("banners/:id")
  @RequirePermissions("settings:update", "org:update", "org:manage_settings")
  deleteBanner(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteBanner(id, { orgId });
  }

  /** Upload a banner image; returns { imageUrl } to set on the banner. */
  @Post("banners/upload-image")
  @RequirePermissions("settings:update", "org:update", "org:manage_settings")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
    }),
  )
  async uploadBannerImage(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    const result = await this.uploadService.saveUploadedFile(
      file,
      `banner-${orgId}-${Date.now()}`,
      "banner",
      uploadMaxBytesFor(user),
    );
    return { imageUrl: result.url };
  }

  @Get("push-campaigns")
  @RequirePermissions("settings:read", "org:read")
  listCampaigns(@OrgId() orgId: string) {
    return this.service.listOrgCampaigns(orgId);
  }

  @Post("push-campaigns")
  @RequirePermissions("settings:update", "org:update", "org:manage_settings")
  sendCampaign(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { title?: string; body?: string; data?: Record<string, string> },
  ) {
    return this.service.sendOrgCampaign(orgId, body, user?.sub);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators";
import type { JwtPayload } from "@cullinos/auth";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { MARKETING_UPLOAD_MAX_BYTES } from "../marketing/marketing-upload.service";
import { GuestOpsService } from "./guest-ops.service";
import { GuestAppPrivacyService } from "./guest-app-privacy.service";
import type { BannerInput } from "./guest-marketing.service";

@Controller("super-admin/guest-ops")
@UseGuards(SuperAdminGuard)
export class GuestOpsController {
  constructor(
    private ops: GuestOpsService,
    private privacy: GuestAppPrivacyService,
  ) {}

  @Get("overview")
  overview() {
    return this.ops.overview();
  }

  @Get("analytics")
  analytics() {
    return this.ops.analyticsSummary();
  }

  @Get("runtime")
  runtime() {
    return this.ops.runtimePreview();
  }

  @Put("runtime")
  updateRuntime(
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, string | null | undefined>,
  ) {
    return this.ops.updateRuntime(body ?? {}, user?.sub);
  }

  // —— Outlets ——
  @Get("outlets")
  listOutlets(
    @Query("q") q?: string,
    @Query("listed") listed?: string,
    @Query("featured") featured?: string,
    @Query("moderationStatus") moderationStatus?: string,
    @Query("city") city?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.ops.listOutlets({
      q,
      listed,
      featured,
      moderationStatus,
      city,
      limit,
      offset,
    });
  }

  @Patch("outlets/:id")
  updateOutlet(
    @Param("id") id: string,
    @Body()
    body: {
      marketplaceListed?: boolean;
      marketplaceFeatured?: boolean;
      marketplaceFeaturedRank?: number | null;
      marketplaceModerationStatus?: string;
      marketplaceUnlistedByPlatform?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      cuisineTags?: string[];
      coverImageUrl?: string | null;
      averagePrepMinutes?: number | null;
      address?: string | null;
      city?: string | null;
      zone?: string | null;
      state?: string | null;
      pincode?: string | null;
    },
  ) {
    return this.ops.updateOutlet(id, body);
  }

  // —— Banners ——
  @Get("banners")
  listBanners(@Query("scope") scope?: "platform" | "organization" | "all") {
    return this.ops.listBanners(scope);
  }

  @Post("banners")
  createBanner(
    @Body()
    body: BannerInput & {
      scope?: "platform" | "organization";
      organizationId?: string | null;
    },
  ) {
    return this.ops.createBanner(body);
  }

  @Patch("banners/:id")
  updateBanner(@Param("id") id: string, @Body() body: BannerInput) {
    return this.ops.updateBanner(id, body);
  }

  @Delete("banners/:id")
  deleteBanner(@Param("id") id: string) {
    return this.ops.deleteBanner(id);
  }

  // —— Push campaigns ——
  @Get("push-campaigns")
  listPushCampaigns(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    return this.ops.listPushCampaigns({ status, limit });
  }

  @Post("push-campaigns")
  createPushDraft(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      title?: string;
      body?: string;
      scope?: string;
      organizationId?: string | null;
      audience?: string;
      audienceFilter?: Record<string, unknown>;
      deepLink?: string | null;
      data?: Record<string, unknown>;
      scheduledAt?: string | null;
      imageUrl?: string | null;
      stylePreset?: string | null;
      creative?: Record<string, unknown>;
    },
  ) {
    return this.ops.createPushDraft(body, user?.sub);
  }

  @Post("push-campaigns/upload-image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
    }),
  )
  uploadPushImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    return this.ops.uploadPushImage(file, {
      isSuperAdmin: true,
    });
  }

  @Patch("push-campaigns/:id")
  updatePushCampaign(
    @Param("id") id: string,
    @Body()
    body: {
      title?: string;
      body?: string;
      audience?: string;
      audienceFilter?: Record<string, unknown>;
      deepLink?: string | null;
      data?: Record<string, unknown>;
      organizationId?: string | null;
      scheduledAt?: string | null;
      imageUrl?: string | null;
      stylePreset?: string | null;
      creative?: Record<string, unknown>;
    },
  ) {
    return this.ops.updatePushCampaign(id, body);
  }

  @Post("push-campaigns/:id/schedule")
  schedulePush(
    @Param("id") id: string,
    @Body() body: { scheduledAt?: string },
  ) {
    return this.ops.schedulePush(id, body?.scheduledAt);
  }

  @Post("push-campaigns/:id/cancel")
  cancelPush(@Param("id") id: string) {
    return this.ops.cancelPush(id);
  }

  @Delete("push-campaigns/:id")
  deletePushCampaign(@Param("id") id: string) {
    return this.ops.deletePushCampaign(id);
  }

  @Post("push-campaigns/:id/send")
  sendPushCampaign(@Param("id") id: string) {
    return this.ops.sendPushCampaign(id);
  }

  // —— Discover sections ——
  @Get("discover-sections")
  listDiscoverSections() {
    return this.ops.listDiscoverSections();
  }

  @Post("discover-sections")
  createDiscoverSection(
    @Body()
    body: {
      title?: string;
      subtitle?: string | null;
      type?: string;
      payload?: Record<string, unknown>;
      sortOrder?: number;
      startsAt?: string | null;
      endsAt?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.ops.createDiscoverSection(body);
  }

  @Patch("discover-sections/:id")
  updateDiscoverSection(
    @Param("id") id: string,
    @Body()
    body: {
      title?: string;
      subtitle?: string | null;
      type?: string;
      payload?: Record<string, unknown>;
      sortOrder?: number;
      startsAt?: string | null;
      endsAt?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.ops.updateDiscoverSection(id, body);
  }

  @Delete("discover-sections/:id")
  deleteDiscoverSection(@Param("id") id: string) {
    return this.ops.deleteDiscoverSection(id);
  }

  // —— Reviews ——
  @Get("reviews")
  listReviews(
    @Query("status") status?: string,
    @Query("outletId") outletId?: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
  ) {
    return this.ops.listReviews({ status, outletId, q, limit });
  }

  @Post("reviews/:id/moderate")
  moderateReview(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { status: "hidden" | "removed" | "visible"; note?: string },
  ) {
    return this.ops.moderateReview(id, body, user?.sub);
  }

  // —— Guest users ——
  @Get("users")
  searchGuestUsers(@Query("q") q?: string, @Query("limit") limit?: string) {
    return this.ops.searchGuestUsers({ q, limit });
  }

  @Get("users/:id")
  getGuestUser(@Param("id") id: string) {
    return this.ops.getGuestUser(id);
  }

  @Get("users/:id/export")
  exportGuestUser(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.privacy.exportGuestUser(id, user?.sub);
  }

  @Post("users/:id/erase")
  eraseGuestUser(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.privacy.eraseGuestUser(id, user?.sub);
  }
}

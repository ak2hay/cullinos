import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators";
import type { JwtPayload } from "@cullinos/auth";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import {
  GuestMarketingService,
  type BannerInput,
} from "./guest-marketing.service";

@Controller("super-admin/guest-marketing")
@UseGuards(SuperAdminGuard)
export class GuestMarketingSuperAdminController {
  constructor(private service: GuestMarketingService) {}

  @Get("banners")
  listBanners() {
    return this.service.listPlatformBanners();
  }

  @Post("banners")
  createBanner(@Body() body: BannerInput) {
    return this.service.createBanner("platform", null, body);
  }

  @Patch("banners/:id")
  updateBanner(@Param("id") id: string, @Body() body: BannerInput) {
    return this.service.updateBanner(id, body, { platformOnly: true });
  }

  @Delete("banners/:id")
  deleteBanner(@Param("id") id: string) {
    return this.service.deleteBanner(id, { platformOnly: true });
  }

  @Get("push-campaigns")
  listCampaigns() {
    return this.service.listPlatformCampaigns();
  }

  @Post("push-campaigns")
  sendCampaign(
    @CurrentUser() user: JwtPayload,
    @Body() body: { title?: string; body?: string; data?: Record<string, string> },
  ) {
    return this.service.sendPlatformCampaign(body, user?.sub);
  }

  @Get("coupons")
  listCoupons() {
    return this.service.listAllCoupons();
  }

  @Post("coupons")
  createCoupon(
    @Body()
    body: {
      organizationId?: string;
      code?: string;
      type?: string;
      value?: number;
      title?: string;
      description?: string;
      imageUrl?: string;
      minOrder?: number;
      maxUses?: number;
      startsAt?: string;
      expiresAt?: string;
      isActive?: boolean;
      marketplaceFeatured?: boolean;
    },
  ) {
    return this.service.createCouponPlatform(body.organizationId ?? "", body);
  }

  @Patch("coupons/:id")
  updateCoupon(
    @Param("id") id: string,
    @Body()
    body: {
      code?: string;
      type?: string;
      value?: number;
      title?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      minOrder?: number | null;
      maxUses?: number | null;
      startsAt?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
      marketplaceFeatured?: boolean;
    },
  ) {
    return this.service.updateCouponPlatform(id, body);
  }

  @Post("coupons/:id/deactivate")
  deactivateCoupon(@Param("id") id: string) {
    return this.service.deactivateCouponPlatform(id);
  }

  @Delete("coupons/:id")
  deleteCoupon(@Param("id") id: string) {
    return this.service.deleteCouponPlatform(id);
  }
}

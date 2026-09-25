import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../common/decorators";
import { assertTurnstile } from "../../common/turnstile.util";
import {
  CurrentGuest,
  GuestAuth,
  GuestAuthGuard,
  type GuestJwtPayload,
} from "./guest-auth.util";
import { GuestService } from "./guest.service";
import { GuestEngagementService } from "./guest-engagement.service";

function clientIp(req: Request): string | undefined {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0]?.trim();
  return req.ip;
}

@Controller("public/guest")
@UseGuards(GuestAuthGuard)
export class GuestController {
  constructor(
    private service: GuestService,
    private engagement: GuestEngagementService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("auth/phone-status")
  phoneStatus(@Body() body: { phone?: string }) {
    return this.service.phoneStatus(body.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("auth/otp/request")
  async requestOtp(
    @Body() body: { phone?: string; captchaToken?: string },
    @Req() req: Request,
  ) {
    await assertTurnstile(body.captchaToken, clientIp(req));
    return this.service.requestOtp(body.phone);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("auth/otp/widget-config")
  widgetConfig() {
    return this.service.widgetConfig();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("auth/otp/widget-send")
  async widgetSend(
    @Body() body: { phone?: string; captchaToken?: string },
    @Req() req: Request,
  ) {
    await assertTurnstile(body.captchaToken, clientIp(req));
    return this.service.widgetSendOtp(body.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("auth/otp/widget-retry")
  widgetRetry(@Body() body: { reqId?: string }) {
    return this.service.widgetRetryOtp(body.reqId);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("auth/otp/widget-confirm")
  widgetConfirm(
    @Body()
    body: {
      reqId?: string;
      otp?: string;
      phone?: string;
      name?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
  ) {
    return this.service.widgetConfirmOtp(body);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("auth/otp/widget-verify")
  verifyWidget(
    @Body()
    body: {
      accessToken?: string;
      phone?: string;
      identifier?: string;
      name?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
  ) {
    return this.service.loginWithMsg91Widget(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("auth/otp/verify")
  verifyOtp(
    @Body()
    body: {
      challengeToken?: string;
      code?: string;
      name?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
    },
  ) {
    return this.service.verifyOtp(body);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("auth/firebase")
  async exchangeFirebase(
    @Body()
    body: {
      idToken?: string;
      name?: string;
      marketingEmailOptIn?: boolean;
      marketingSmsOptIn?: boolean;
      captchaToken?: string;
    },
    @Req() req: Request,
  ) {
    await assertTurnstile(body.captchaToken, clientIp(req));
    return this.service.exchangeFirebaseToken(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("auth/pin/login")
  async pinLogin(
    @Body() body: { phone?: string; pin?: string; captchaToken?: string },
    @Req() req: Request,
  ) {
    await assertTurnstile(body.captchaToken, clientIp(req));
    return this.service.loginWithPin(body.phone, body.pin);
  }

  @Public()
  @GuestAuth()
  @Post("auth/pin/set")
  setPin(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { pin?: string; name?: string },
  ) {
    return this.service.setPin(guest.sub, body.pin, body.name);
  }

  @Public()
  @GuestAuth()
  @Post("auth/pin/change")
  changePin(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { currentPin?: string; newPin?: string },
  ) {
    return this.service.changePin(guest.sub, body.currentPin, body.newPin);
  }

  @Public()
  @GuestAuth()
  @Get("auth/me")
  me(@CurrentGuest() guest: GuestJwtPayload) {
    return this.service.me(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Get("coins")
  getCoins(@CurrentGuest() guest: GuestJwtPayload) {
    return this.service.getCoins(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Patch("auth/me")
  updateMe(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { name?: string; email?: string | null },
  ) {
    return this.service.updateProfile(guest.sub, body);
  }

  @Public()
  @GuestAuth()
  @Post("memberships/:orgId/ensure")
  ensureMembership(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("orgId") orgId: string,
    @Body() body: { name?: string },
  ) {
    return this.service.ensureMembership(guest.sub, orgId, body.name);
  }

  @Public()
  @GuestAuth()
  @Get("memberships")
  listMemberships(@CurrentGuest() guest: GuestJwtPayload) {
    return this.service.listMemberships(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Post("devices")
  registerDevice(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { fcmToken?: string; platform?: string },
  ) {
    return this.service.registerDevice(guest.sub, body.fcmToken, body.platform);
  }

  @Public()
  @GuestAuth()
  @Get("addresses")
  listAddresses(@CurrentGuest() guest: GuestJwtPayload) {
    return this.service.listAddresses(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Post("addresses")
  createAddress(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body()
    body: {
      label?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    },
  ) {
    return this.service.createAddress(guest.sub, body);
  }

  @Public()
  @GuestAuth()
  @Patch("addresses/:id")
  updateAddress(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("id") id: string,
    @Body()
    body: {
      label?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    },
  ) {
    return this.service.updateAddress(guest.sub, id, body);
  }

  @Public()
  @GuestAuth()
  @Delete("addresses/:id")
  deleteAddress(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("id") id: string,
  ) {
    return this.service.deleteAddress(guest.sub, id);
  }

  @Public()
  @GuestAuth()
  @Get("favorites/outlets")
  favoriteOutlets(@CurrentGuest() guest: GuestJwtPayload) {
    return this.engagement.listFavoriteOutlets(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Post("favorites/outlets")
  addFavoriteOutlet(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { outletId?: string },
  ) {
    return this.engagement.addFavoriteOutlet(guest.sub, body.outletId);
  }

  @Public()
  @GuestAuth()
  @Delete("favorites/outlets/:outletId")
  removeFavoriteOutlet(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("outletId") outletId: string,
  ) {
    return this.engagement.removeFavoriteOutlet(guest.sub, outletId);
  }

  @Public()
  @GuestAuth()
  @Get("favorites/items")
  favoriteItems(@CurrentGuest() guest: GuestJwtPayload) {
    return this.engagement.listFavoriteItems(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Post("favorites/items")
  addFavoriteItem(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { menuItemId?: string; organizationId?: string },
  ) {
    return this.engagement.addFavoriteItem(guest.sub, body);
  }

  @Public()
  @GuestAuth()
  @Delete("favorites/items/:menuItemId")
  removeFavoriteItem(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("menuItemId") menuItemId: string,
  ) {
    return this.engagement.removeFavoriteItem(guest.sub, menuItemId);
  }

  @Public()
  @GuestAuth()
  @Post("reviews")
  createReview(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body()
    body: {
      outletId?: string;
      orderId?: string;
      rating?: number;
      comment?: string;
    },
  ) {
    return this.engagement.createReview(guest.sub, body);
  }

  @Public()
  @Get("reviews/outlet/:outletId")
  outletReviews(
    @Param("outletId") outletId: string,
    @Query("limit") limit?: string,
  ) {
    return this.engagement.listOutletReviews(
      outletId,
      limit ? Number(limit) : 30,
    );
  }

  @Public()
  @GuestAuth()
  @Get("reviews/mine")
  myReviews(@CurrentGuest() guest: GuestJwtPayload) {
    return this.engagement.myReviews(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Get("notifications")
  notifications(
    @CurrentGuest() guest: GuestJwtPayload,
    @Query("limit") limit?: string,
  ) {
    return this.engagement.listNotifications(
      guest.sub,
      limit ? Number(limit) : 50,
    );
  }

  @Public()
  @GuestAuth()
  @Post("notifications/:id/read")
  markRead(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("id") id: string,
  ) {
    return this.engagement.markNotificationRead(guest.sub, id);
  }

  @Public()
  @GuestAuth()
  @Post("notifications/read-all")
  markAllRead(@CurrentGuest() guest: GuestJwtPayload) {
    return this.engagement.markAllNotificationsRead(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Delete("notifications/:id")
  deleteNotification(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("id") id: string,
  ) {
    return this.engagement.deleteNotification(guest.sub, id);
  }

  @Public()
  @GuestAuth()
  @Get("notifications/unread-count")
  unreadCount(@CurrentGuest() guest: GuestJwtPayload) {
    return this.engagement.unreadNotificationCount(guest.sub).then((count) => ({
      count,
    }));
  }

  @Public()
  @GuestAuth()
  @Get("notification-preferences")
  getPrefs(@CurrentGuest() guest: GuestJwtPayload) {
    return this.engagement.getNotificationPrefs(guest.sub);
  }

  @Public()
  @GuestAuth()
  @Patch("notification-preferences")
  patchPrefs(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body()
    body: { transactionalEnabled?: boolean; marketingEnabled?: boolean },
  ) {
    return this.engagement.patchNotificationPrefs(guest.sub, body);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { BUSINESS_TYPES } from "@cullinos/shared";
import { CurrentUser, Public, RequirePlatformPermission } from "../../common/decorators";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { Msg91Service } from "../sms/msg91.service";
import { SuperAdminService } from "./super-admin.service";
import { RefreshCookieInterceptor } from "../auth/refresh-cookie.interceptor";
import { LabsSqlDto, UpdateOrgEnvironmentDto } from "./dto/super-admin.dto";

class SuperAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password!: string;
}

class VerifyOtpDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}

class ResendOtpDto {
  @IsString()
  challengeToken!: string;
}

class SuspendDto {
  @IsString()
  reason!: string;
}

class ImpersonateDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

const RESTAURANT_SIZES = ["small", "medium", "large"] as const;

class OnboardRestaurantDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsString()
  planSlug!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsOptional()
  ownerPhone?: string;

  @IsString()
  @IsOptional()
  outletName?: string;

  @IsString()
  @IsOptional()
  @IsIn([...BUSINESS_TYPES])
  businessType?: string;

  @IsOptional()
  @IsString()
  @IsIn([...RESTAURANT_SIZES])
  restaurantSize?: string | null;
}

class UpdatePlanModulesDto {
  @IsArray()
  @IsString({ each: true })
  modules!: string[];
}

class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priceMonthly?: number;

  @IsOptional()
  @IsNumber()
  priceYearly?: number;

  @IsOptional()
  @IsNumber()
  maxOutlets?: number;

  @IsOptional()
  @IsNumber()
  maxTerminals?: number;

  @IsOptional()
  @IsNumber()
  maxUsers?: number;

  @IsOptional()
  @IsIn(["public", "private"])
  visibility?: "public" | "private";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];
}

class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber()
  priceMonthly?: number;

  @IsOptional()
  @IsNumber()
  priceYearly?: number;

  @IsOptional()
  @IsNumber()
  maxOutlets?: number;

  @IsOptional()
  @IsNumber()
  maxTerminals?: number;

  @IsOptional()
  @IsNumber()
  maxUsers?: number;

  @IsOptional()
  @IsIn(["public", "private"])
  visibility?: "public" | "private";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class UpdateSettingsGroupDto {
  @IsObject()
  values!: Record<string, string>;
}

class Msg91TestDto {
  @IsOptional()
  @IsString()
  phone?: string;
}

class SmtpTestDto {
  @IsOptional()
  @IsString()
  @IsEmail()
  to?: string;
}

@Controller("super-admin")
@UseGuards(SuperAdminGuard)
export class SuperAdminController {
  constructor(
    private service: SuperAdminService,
    private msg91: Msg91Service,
    private platformConfig: PlatformConfigService,
    private mail: MailService,
    private audit: AuditService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @UseInterceptors(RefreshCookieInterceptor)
  login(@Body() dto: SuperAdminLoginDto) {
    return this.service.login(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-otp")
  @UseInterceptors(RefreshCookieInterceptor)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.service.verifyOtp(dto.challengeToken, dto.otp);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("resend-otp")
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.service.resendOtp(dto.challengeToken);
  }

  @Get("analytics/overview")
  @RequirePlatformPermission("dashboard.read")
  analyticsOverview(@Query("range") range?: string) {
    const normalized =
      range === "7d" || range === "90d" || range === "30d" ? range : "30d";
    return this.service.analyticsOverview(normalized);
  }

  @Post("organizations")
  @RequirePlatformPermission("tenants.write")
  onboardRestaurant(@Body() body: OnboardRestaurantDto) {
    return this.service.onboardRestaurant(body);
  }

  @Get("organizations")
  @RequirePlatformPermission("tenants.read")
  listOrganizations(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("planSlug") planSlug?: string,
  ) {
    return this.service.listOrganizations(Number(page) || 1, Number(limit) || 20, {
      q,
      status,
      planSlug,
    });
  }

  @Get("organizations/:id")
  @RequirePlatformPermission("tenants.read")
  getOrganization(@Param("id") id: string) {
    return this.service.getOrganization(id);
  }

  @Patch("organizations/:id/environment")
  @RequirePlatformPermission("tenants.write")
  updateOrganizationEnvironment(
    @Param("id") id: string,
    @Body() body: UpdateOrgEnvironmentDto,
  ) {
    return this.service.updateOrganizationEnvironment(id, body);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("labs/step-up")
  @RequirePlatformPermission("labs.sql")
  startLabsStepUp(@CurrentUser() user: JwtPayload) {
    return this.service.startLabsStepUp(user.sub, user.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("labs/step-up/verify")
  @RequirePlatformPermission("labs.sql")
  verifyLabsStepUp(@Body() dto: VerifyOtpDto, @CurrentUser() user: JwtPayload) {
    return this.service.verifyLabsStepUp(user.sub, dto.challengeToken, dto.otp);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("labs/sql")
  @RequirePlatformPermission("labs.sql")
  runLabsSql(
    @Body() body: LabsSqlDto,
    @CurrentUser() user: JwtPayload,
    @Headers("x-step-up-token") stepUpToken?: string,
  ) {
    this.service.assertLabsStepUp(user.sub, stepUpToken);
    return this.service.runLabsSql(body.sql, user.email);
  }

  @Get("labs/sql-audits")
  @RequirePlatformPermission("labs.sql")
  listLabsSqlAudits(@Query("limit") limit?: string) {
    return this.service.listLabsSqlAudits(Number(limit) || 50);
  }

  @Get("organizations/:id/users")
  @RequirePlatformPermission("tenants.read")
  listOrganizationUsers(@Param("id") id: string) {
    return this.service.listOrganizationUsers(id);
  }

  @Post("organizations/:id/users/:userId/reset-password")
  @RequirePlatformPermission("tenant_users.manage")
  resetOrganizationUserPassword(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resetOrganizationUserPassword(id, userId, user.sub);
  }

  @Patch("organizations/:id/users/:userId/deactivate")
  @RequirePlatformPermission("tenant_users.manage")
  deactivateOrganizationUser(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body?: { reason?: string },
  ) {
    return this.service.deactivateOrganizationUser(id, userId, user.sub, body?.reason);
  }

  @Patch("organizations/:id/users/:userId/activate")
  @RequirePlatformPermission("tenant_users.manage")
  activateOrganizationUser(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.activateOrganizationUser(id, userId, user.sub);
  }

  @Post("organizations/:id/impersonate")
  @RequirePlatformPermission("tenants.impersonate")
  impersonate(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImpersonateDto,
  ) {
    return this.service.impersonateOrganization(id, user.sub, dto.reason);
  }

  @Get("audit-logs")
  @RequirePlatformPermission("audit.read")
  listAuditLogs(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("organizationId") organizationId?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.listAuditLogs(Number(page) || 1, Number(limit) || 50, organizationId, {
      action,
      from,
      to,
    });
  }

  @Get("users")
  @RequirePlatformPermission("tenants.read")
  listPlatformUsers(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("organizationId") organizationId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
  ) {
    return this.service.listPlatformUsers({
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      organizationId,
      status,
      q,
    });
  }

  @Delete("organizations/:id")
  @RequirePlatformPermission("tenants.delete")
  deleteOrganization(@Param("id") id: string) {
    return this.service.deleteOrganization(id);
  }

  @Get("tenants")
  @RequirePlatformPermission("tenants.read")
  listTenants() {
    return this.service.listTenants();
  }

  @Patch("organizations/:id/suspend")
  @RequirePlatformPermission("tenants.suspend")
  suspendOrganization(
    @Param("id") id: string,
    @Body() body: SuspendDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.suspendTenant(id, body.reason, user.sub);
  }

  @Patch("organizations/:id/activate")
  @RequirePlatformPermission("tenants.suspend")
  activateOrganization(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reactivateTenant(id, user.sub);
  }

  @Put("organizations/:id/subscription")
  @RequirePlatformPermission("subscriptions.manage")
  manageSubscription(
    @Param("id") id: string,
    @Body() body: { planId?: string; planSlug?: string; status: string },
  ) {
    return this.service.manageSubscription(id, body);
  }

  @Post("organizations/:id/subscription/collect")
  @RequirePlatformPermission("subscriptions.manage")
  collectSubscription(@Param("id") id: string) {
    return this.service.collectSubscription(id);
  }

  @Get("plans")
  @RequirePlatformPermission("plans.read")
  listPlans(@Query("visibility") visibility?: string) {
    const filter =
      visibility === "public" || visibility === "private" ? visibility : undefined;
    return this.service.listPlans(filter);
  }

  @Post("plans/sync-razorpay")
  @RequirePlatformPermission("plans.manage")
  syncPlansToRazorpay() {
    return this.service.syncPlansToRazorpay();
  }

  @Post("plans")
  @RequirePlatformPermission("plans.manage")
  createPlan(@Body() body: CreatePlanDto) {
    return this.service.createPlan(body);
  }

  @Patch("plans/:id")
  @RequirePlatformPermission("plans.manage")
  updatePlan(@Param("id") id: string, @Body() body: UpdatePlanDto) {
    return this.service.updatePlan(id, body);
  }

  @Delete("plans/:id")
  @RequirePlatformPermission("plans.manage")
  deactivatePlan(@Param("id") id: string) {
    return this.service.deactivatePlan(id);
  }

  @Patch("plans/:id/modules")
  @RequirePlatformPermission("plans.manage")
  updatePlanModules(@Param("id") id: string, @Body() body: UpdatePlanModulesDto) {
    return this.service.updatePlanModules(id, body.modules);
  }

  @Get("sms-status")
  @RequirePlatformPermission("health.read")
  smsStatus() {
    return this.msg91.status();
  }

  @Get("settings")
  @RequirePlatformPermission("settings.manage")
  getSettings() {
    return this.platformConfig.getStatus();
  }

  @Put("settings/:group")
  @RequirePlatformPermission("settings.manage")
  async updateSettingsGroup(
    @Param("group") group: string,
    @Body() body: UpdateSettingsGroupDto,
    @Req() req: { user?: { sub?: string; email?: string; organizationId?: string } },
  ) {
    const updatedBy = req.user?.email ?? req.user?.sub;
    const result = await this.platformConfig.upsertGroup(group, body.values ?? {}, updatedBy);
    if (req.user?.organizationId) {
      // Key names only: values (including secrets) never go into the audit trail.
      await this.audit.log({
        organizationId: req.user.organizationId,
        userId: req.user.sub,
        action: "platform.settings_update",
        entityType: "platform_settings",
        entityId: group,
        metadata: { keys: Object.keys(body.values ?? {}) },
      });
    }
    return result;
  }

  @Post("settings/smtp/test")
  @RequirePlatformPermission("settings.manage")
  testSmtp(@Body() body: SmtpTestDto) {
    return this.mail.testSmtp(body.to);
  }

  @Post("settings/msg91/test")
  @RequirePlatformPermission("settings.manage")
  testMsg91(@Body() body: Msg91TestDto) {
    return this.msg91.testConfig(body.phone);
  }

  @Patch("tenants/:id/suspend")
  @RequirePlatformPermission("tenants.suspend")
  suspend(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.service.suspendTenant(id, undefined, user.sub);
  }

  @Patch("tenants/:id/reactivate")
  @RequirePlatformPermission("tenants.suspend")
  reactivate(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reactivateTenant(id, user.sub);
  }

  @Get("health")
  @RequirePlatformPermission("health.read")
  health() {
    return this.service.health();
  }
}

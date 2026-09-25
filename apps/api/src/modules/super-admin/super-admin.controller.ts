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
import { CurrentUser, Public } from "../../common/decorators";
import { MailService } from "../mail/mail.service";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { Msg91Service } from "../sms/msg91.service";
import { SuperAdminService } from "./super-admin.service";
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

const BUSINESS_TYPES = [
  "restaurant",
  "cafe",
  "food_truck",
  "bakery",
  "qsr",
  "cloud_kitchen",
  "catering",
] as const;

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
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: SuperAdminLoginDto) {
    return this.service.login(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-otp")
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
  analyticsOverview(@Query("range") range?: string) {
    const normalized =
      range === "7d" || range === "90d" || range === "30d" ? range : "30d";
    return this.service.analyticsOverview(normalized);
  }

  @Post("organizations")
  onboardRestaurant(@Body() body: OnboardRestaurantDto) {
    return this.service.onboardRestaurant(body);
  }

  @Get("organizations")
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
  getOrganization(@Param("id") id: string) {
    return this.service.getOrganization(id);
  }

  @Patch("organizations/:id/environment")
  updateOrganizationEnvironment(
    @Param("id") id: string,
    @Body() body: UpdateOrgEnvironmentDto,
  ) {
    return this.service.updateOrganizationEnvironment(id, body);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("labs/step-up")
  startLabsStepUp(@CurrentUser() user: JwtPayload) {
    return this.service.startLabsStepUp(user.sub, user.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("labs/step-up/verify")
  verifyLabsStepUp(@Body() dto: VerifyOtpDto, @CurrentUser() user: JwtPayload) {
    return this.service.verifyLabsStepUp(user.sub, dto.challengeToken, dto.otp);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("labs/sql")
  runLabsSql(
    @Body() body: LabsSqlDto,
    @CurrentUser() user: JwtPayload,
    @Headers("x-step-up-token") stepUpToken?: string,
  ) {
    this.service.assertLabsStepUp(user.sub, stepUpToken);
    return this.service.runLabsSql(body.sql, user.email);
  }

  @Get("labs/sql-audits")
  listLabsSqlAudits(@Query("limit") limit?: string) {
    return this.service.listLabsSqlAudits(Number(limit) || 50);
  }

  @Get("organizations/:id/users")
  listOrganizationUsers(@Param("id") id: string) {
    return this.service.listOrganizationUsers(id);
  }

  @Post("organizations/:id/users/:userId/reset-password")
  resetOrganizationUserPassword(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resetOrganizationUserPassword(id, userId, user.sub);
  }

  @Patch("organizations/:id/users/:userId/deactivate")
  deactivateOrganizationUser(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body?: { reason?: string },
  ) {
    return this.service.deactivateOrganizationUser(id, userId, user.sub, body?.reason);
  }

  @Patch("organizations/:id/users/:userId/activate")
  activateOrganizationUser(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.activateOrganizationUser(id, userId, user.sub);
  }

  @Post("organizations/:id/impersonate")
  impersonate(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImpersonateDto,
  ) {
    return this.service.impersonateOrganization(id, user.sub, dto.reason);
  }

  @Get("audit-logs")
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
  deleteOrganization(@Param("id") id: string) {
    return this.service.deleteOrganization(id);
  }

  @Get("tenants")
  listTenants() {
    return this.service.listTenants();
  }

  @Patch("organizations/:id/suspend")
  suspendOrganization(
    @Param("id") id: string,
    @Body() body: SuspendDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.suspendTenant(id, body.reason, user.sub);
  }

  @Patch("organizations/:id/activate")
  activateOrganization(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reactivateTenant(id, user.sub);
  }

  @Put("organizations/:id/subscription")
  manageSubscription(
    @Param("id") id: string,
    @Body() body: { planId?: string; planSlug?: string; status: string },
  ) {
    return this.service.manageSubscription(id, body);
  }

  @Post("organizations/:id/subscription/collect")
  collectSubscription(@Param("id") id: string) {
    return this.service.collectSubscription(id);
  }

  @Get("plans")
  listPlans() {
    return this.service.listPlans();
  }

  @Post("plans")
  createPlan(@Body() body: CreatePlanDto) {
    return this.service.createPlan(body);
  }

  @Patch("plans/:id")
  updatePlan(@Param("id") id: string, @Body() body: UpdatePlanDto) {
    return this.service.updatePlan(id, body);
  }

  @Delete("plans/:id")
  deactivatePlan(@Param("id") id: string) {
    return this.service.deactivatePlan(id);
  }

  @Patch("plans/:id/modules")
  updatePlanModules(@Param("id") id: string, @Body() body: UpdatePlanModulesDto) {
    return this.service.updatePlanModules(id, body.modules);
  }

  @Get("sms-status")
  smsStatus() {
    return this.msg91.status();
  }

  @Get("settings")
  getSettings() {
    return this.platformConfig.getStatus();
  }

  @Put("settings/:group")
  updateSettingsGroup(
    @Param("group") group: string,
    @Body() body: UpdateSettingsGroupDto,
    @Req() req: { user?: { sub?: string; email?: string } },
  ) {
    const updatedBy = req.user?.email ?? req.user?.sub;
    return this.platformConfig.upsertGroup(group, body.values ?? {}, updatedBy);
  }

  @Post("settings/smtp/test")
  testSmtp(@Body() body: SmtpTestDto) {
    return this.mail.testSmtp(body.to);
  }

  @Post("settings/msg91/test")
  testMsg91(@Body() body: Msg91TestDto) {
    return this.msg91.testConfig(body.phone);
  }

  @Patch("tenants/:id/suspend")
  suspend(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.service.suspendTenant(id, undefined, user.sub);
  }

  @Patch("tenants/:id/reactivate")
  reactivate(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reactivateTenant(id, user.sub);
  }

  @Get("health")
  health() {
    return this.service.health();
  }
}

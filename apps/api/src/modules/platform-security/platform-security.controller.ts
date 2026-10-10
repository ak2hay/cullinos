import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { AnyPlatformStaff, CurrentUser, RequirePlatformPermission } from "../../common/decorators";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import type { EffectiveAccess } from "../platform-iam/platform-access.util";
import { PlatformSecurityService } from "./platform-security.service";

class CampaignDto {
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsDateString() dueAt!: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsBoolean() includePrimaryRoles?: boolean;
}

class ReviewDecisionDto {
  @IsIn(["certified", "revoked"]) decision!: "certified" | "revoked";
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

class ElevationDto {
  @IsString() roleId!: string;
  @IsInt() @Min(15) @Max(480) durationMinutes!: number;
  @IsString() @MinLength(15) @MaxLength(2000) justification!: string;
  @IsOptional() @IsString() ticketId?: string;
}

type Req = { platformAccess?: EffectiveAccess };

@Controller("super-admin/security")
@UseGuards(SuperAdminGuard)
export class PlatformSecurityController {
  constructor(private security: PlatformSecurityService) {}

  @Get("reviews")
  @RequirePlatformPermission("access_reviews.manage")
  campaigns() {
    return this.security.listCampaigns();
  }

  @Post("reviews")
  @RequirePlatformPermission("access_reviews.manage")
  createCampaign(@CurrentUser() user: JwtPayload, @Body() dto: CampaignDto) {
    return this.security.createCampaign(user, dto);
  }

  @Get("reviews/mine")
  @AnyPlatformStaff()
  myReviews(@CurrentUser() user: JwtPayload) {
    return this.security.myReviews(user);
  }

  @Get("reviews/:id")
  @AnyPlatformStaff()
  campaign(@CurrentUser() user: JwtPayload, @Req() req: Req, @Param("id") id: string) {
    return this.security.getCampaign(user, req.platformAccess, id);
  }

  @Post("reviews/items/:id/decision")
  @AnyPlatformStaff()
  decide(
    @CurrentUser() user: JwtPayload,
    @Req() req: Req,
    @Param("id") id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.security.decideItem(user, req.platformAccess, id, dto.decision, dto.comment);
  }

  @Post("reviews/:id/close")
  @RequirePlatformPermission("access_reviews.manage")
  close(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.security.closeCampaign(user, id);
  }

  @Get("sessions")
  @RequirePlatformPermission("sessions.manage")
  sessions(@Query("userId") userId?: string) {
    return this.security.listSessions({ userId });
  }

  @Get("sessions/mine")
  @AnyPlatformStaff()
  mySessions(@CurrentUser() user: JwtPayload) {
    return this.security.listSessions({ userId: user.sub });
  }

  @Post("sessions/:id/revoke")
  @AnyPlatformStaff()
  revokeSession(@CurrentUser() user: JwtPayload, @Req() req: Req, @Param("id") id: string) {
    const canManage = Boolean(req.platformAccess?.global.includes("sessions.manage"));
    return this.security.revokeSession(user, id, !canManage);
  }

  @Post("users/:userId/revoke-sessions")
  @RequirePlatformPermission("sessions.manage")
  revokeAll(@CurrentUser() user: JwtPayload, @Param("userId") userId: string) {
    return this.security.revokeAllForUser(user, userId);
  }

  @Get("elevation/roles")
  @AnyPlatformStaff()
  elevationRoles() {
    return this.security.elevationRoles();
  }

  @Post("elevation")
  @AnyPlatformStaff()
  elevate(@CurrentUser() user: JwtPayload, @Body() dto: ElevationDto) {
    return this.security.requestElevation(user, dto);
  }
}

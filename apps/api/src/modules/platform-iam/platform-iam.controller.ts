import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import {
  AnyPlatformStaff,
  CurrentUser,
  RequirePlatformPermission,
  RequiresApproval,
  SkipActivityLog,
  SkipStepUp,
} from "../../common/decorators";
import { clientIp } from "../../common/client-ip.util";
import { AuthService } from "../auth/auth.service";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { PlatformAccessService } from "./platform-access.service";
import { ipMatchesAllowlist, type EffectiveAccess } from "./platform-access.util";
import { PlatformActivityService } from "./platform-activity.service";
import { PlatformIamService } from "./platform-iam.service";
import { PlatformNotificationsService } from "./platform-notifications.service";
import { PlatformSecuritySettingsService } from "./platform-security-settings.service";

class DepartmentDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(2) @MaxLength(21) code!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() headUserId?: string | null;
}

class UpdateDepartmentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsString() headUserId?: string | null;
}

class TeamDto {
  @IsString() departmentId!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(2) @MaxLength(21) code!: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() leadUserId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) ipAllowlist?: string[];
}

class UpdateTeamDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsString() leadUserId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) ipAllowlist?: string[];
}

class RoleDto {
  @IsString() @MinLength(3) @MaxLength(41) key!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissions!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) ipAllowlist?: string[];
}

class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) ipAllowlist?: string[];
}

class AssignRoleDto {
  @IsString() userId!: string;
  @IsString() roleId!: string;
  @IsOptional() @IsIn(["global", "region", "tenant_set"]) scopeType?: "global" | "region" | "tenant_set";
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) scopeValues?: string[];
  @IsOptional() @IsDateString() expiresAt?: string | null;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

class MarkReadDto {
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) ids?: string[];
}

class SecuritySettingsDto {
  @IsOptional() @IsBoolean() stepUpCritical?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) globalIpAllowlist?: string[];
}

class StepUpVerifyDto {
  @IsString() challengeToken!: string;
  @IsString() @Length(6, 6) otp!: string;
}

type PlatformReq = {
  ip?: string;
  platformAccess?: EffectiveAccess;
  approvalRequest?: { id: string } | null;
};

@Controller("super-admin/iam")
@UseGuards(SuperAdminGuard)
export class PlatformIamController {
  constructor(
    private iam: PlatformIamService,
    private access: PlatformAccessService,
    private activity: PlatformActivityService,
    private notifications: PlatformNotificationsService,
    private security: PlatformSecuritySettingsService,
    private auth: AuthService,
  ) {}

  /** The signed-in staff member's live access, used by the SPA to show/hide sections. */
  @Get("me")
  @AnyPlatformStaff()
  @SkipActivityLog()
  async me(@CurrentUser() user: JwtPayload, @Req() req: PlatformReq) {
    const identity = await this.access.identity(user.sub);
    const access = req.platformAccess;
    return {
      identity,
      primaryRole: access?.primaryRole ?? null,
      isOwner: access?.isOwner ?? false,
      roleKeys: access?.roleKeys ?? [],
      permissions: access?.global ?? [],
      scoped: access?.scoped ?? [],
    };
  }

  @Get("catalog")
  @RequirePlatformPermission("iam.read", "iam.manage", "iam.assign")
  catalog() {
    return this.iam.catalog();
  }

  // Departments
  @Get("departments")
  @RequirePlatformPermission("iam.read", "directory.read")
  listDepartments() {
    return this.iam.listDepartments();
  }

  @Post("departments")
  @RequirePlatformPermission("iam.manage")
  createDepartment(@Body() dto: DepartmentDto) {
    return this.iam.createDepartment(dto);
  }

  @Patch("departments/:id")
  @RequirePlatformPermission("iam.manage")
  updateDepartment(@Param("id") id: string, @Body() dto: UpdateDepartmentDto) {
    return this.iam.updateDepartment(id, dto);
  }

  @Delete("departments/:id")
  @RequirePlatformPermission("iam.manage")
  deleteDepartment(@Param("id") id: string) {
    return this.iam.deleteDepartment(id);
  }

  // Teams
  @Get("teams")
  @RequirePlatformPermission("iam.read", "directory.read")
  listTeams() {
    return this.iam.listTeams();
  }

  @Post("teams")
  @RequirePlatformPermission("iam.manage")
  createTeam(@Body() dto: TeamDto) {
    return this.iam.createTeam(dto);
  }

  @Patch("teams/:id")
  @RequirePlatformPermission("iam.manage")
  updateTeam(@Param("id") id: string, @Body() dto: UpdateTeamDto) {
    return this.iam.updateTeam(id, dto);
  }

  @Delete("teams/:id")
  @RequirePlatformPermission("iam.manage")
  deleteTeam(@Param("id") id: string) {
    return this.iam.deleteTeam(id);
  }

  // Roles
  @Get("roles")
  @RequirePlatformPermission("iam.read", "iam.assign")
  listRoles() {
    return this.iam.listRoles();
  }

  @Post("roles")
  @RequirePlatformPermission("iam.manage")
  @RequiresApproval("iam.role_create", "Create custom role")
  createRole(@Body() dto: RoleDto) {
    return this.iam.createRole(dto);
  }

  @Patch("roles/:id")
  @RequirePlatformPermission("iam.manage")
  @RequiresApproval("iam.role_update", "Change custom role permissions")
  updateRole(@Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.iam.updateRole(id, dto);
  }

  @Delete("roles/:id")
  @RequirePlatformPermission("iam.manage")
  deleteRole(@Param("id") id: string) {
    return this.iam.deleteRole(id);
  }

  // Assignments
  @Get("assignments")
  @RequirePlatformPermission("iam.read", "iam.assign")
  listAssignments(
    @Req() req: PlatformReq,
    @Query("userId") userId?: string,
    @Query("roleId") roleId?: string,
    @Query("includeRevoked") includeRevoked?: string,
  ) {
    this.assertOwner(req);
    return this.iam.listAssignments({ userId, roleId, includeRevoked: includeRevoked === "true" });
  }

  @Post("assignments")
  @RequirePlatformPermission("iam.assign")
  @RequiresApproval("iam.assign", "Grant platform role")
  assignRole(@CurrentUser() user: JwtPayload, @Body() dto: AssignRoleDto, @Req() req: PlatformReq) {
    this.assertOwner(req);
    return this.iam.assignRole(user, dto, req.approvalRequest?.id);
  }

  @Delete("assignments/:id")
  @RequirePlatformPermission("iam.assign")
  revokeAssignment(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Req() req: PlatformReq) {
    this.assertOwner(req);
    return this.iam.revokeAssignment(user, id);
  }

  private assertOwner(req: PlatformReq) {
    if (!req.platformAccess?.isOwner) {
      throw new ForbiddenException("Role assignments are restricted to platform owners");
    }
  }

  // Notifications
  @Get("notifications")
  @AnyPlatformStaff()
  @SkipActivityLog()
  notificationsList(@CurrentUser() user: JwtPayload, @Query("unread") unread?: string) {
    return this.notifications.list(user.sub, { unreadOnly: unread === "true" });
  }

  @Post("notifications/read")
  @AnyPlatformStaff()
  @SkipActivityLog()
  markRead(@CurrentUser() user: JwtPayload, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user.sub, dto.ids);
  }

  // Activity log
  @Get("activity")
  @RequirePlatformPermission("activity.read")
  listActivity(
    @Query("employeeCode") employeeCode?: string,
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("targetOrgId") targetOrgId?: string,
    @Query("grantId") grantId?: string,
    @Query("ticketId") ticketId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.activity.list({
      employeeCode,
      userId,
      action,
      targetOrgId,
      grantId,
      ticketId,
      from,
      to,
      cursor,
      limit: Number(limit) || 50,
    });
  }

  @Get("activity/verify")
  @RequirePlatformPermission("activity.read")
  verifyActivity(@Query("limit") limit?: string) {
    return this.activity.verify(Number(limit) || 1000);
  }

  @Get("activity/export")
  @RequirePlatformPermission("activity.export")
  @RequiresApproval("activity.export", "Export staff activity log")
  async exportActivity(
    @Query("employeeCode") employeeCode?: string,
    @Query("action") action?: string,
    @Query("targetOrgId") targetOrgId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return { csv: await this.activity.exportCsv({ employeeCode, action, targetOrgId, from, to }) };
  }

  // Security policy
  @Get("security")
  @RequirePlatformPermission("security.manage")
  getSecurity() {
    return this.security.get();
  }

  @Put("security")
  @RequirePlatformPermission("security.manage")
  @RequiresApproval("security.update", "Change platform security policy")
  async updateSecurity(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SecuritySettingsDto,
    @Req() req: PlatformReq,
  ) {
    if (dto.globalIpAllowlist?.length && !ipMatchesAllowlist(clientIp(req as never), dto.globalIpAllowlist)) {
      throw new BadRequestException("Your current IP is not in the new allowlist; you would lock yourself out");
    }
    return this.security.update(dto, user.email ?? user.sub);
  }

  // Step-up for critical actions
  @Post("step-up")
  @AnyPlatformStaff()
  @SkipStepUp()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  startStepUp(@CurrentUser() user: JwtPayload) {
    if (!user.email) throw new BadRequestException("No email on this session");
    return this.auth.startStepUp(user.sub, user.email);
  }

  @Post("step-up/verify")
  @AnyPlatformStaff()
  @SkipStepUp()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyStepUp(@CurrentUser() user: JwtPayload, @Body() dto: StepUpVerifyDto) {
    return this.auth.verifyStepUp(user.sub, dto.challengeToken, dto.otp, "platform");
  }
}

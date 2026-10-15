import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, RequirePlatformPermission } from "../../common/decorators";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import type { EffectiveAccess } from "../platform-iam/platform-access.util";
import { PlatformPeopleService } from "./platform-people.service";

class UpdateEmployeeDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsString() teamId?: string | null;
  @IsOptional() @IsString() managerUserId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) region?: string | null;
  @IsOptional() @IsString() @MaxLength(120) location?: string | null;
  @IsOptional() @IsIn(["active", "on_leave", "notice"]) employmentStatus?: "active" | "on_leave" | "notice";
  @IsOptional() @IsDateString() joinedAt?: string | null;
}

class OffboardDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() transferToUserId?: string | null;
}

class BulkInviteRowDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() platformRole?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsString() teamCode?: string;
  @IsOptional() @IsEmail() managerEmail?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
}

class BulkInviteDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => BulkInviteRowDto)
  rows!: BulkInviteRowDto[];
}

class ShiftDto {
  @IsString() userId!: string;
  @IsOptional() @IsString() teamId?: string | null;
  @IsIn(["shift", "on_call", "leave"]) kind!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class RotationDto {
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) memberUserIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(31) rotationDays?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller("super-admin/people")
@UseGuards(SuperAdminGuard)
export class PlatformPeopleController {
  constructor(private people: PlatformPeopleService) {}

  @Get("directory")
  @RequirePlatformPermission("directory.read")
  directory(
    @Query("q") q?: string,
    @Query("departmentId") departmentId?: string,
    @Query("teamId") teamId?: string,
    @Query("status") status?: string,
    @Query("managerUserId") managerUserId?: string,
    @Query("role") role?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.people.directory({
      q,
      departmentId,
      teamId,
      status,
      managerUserId,
      role,
      cursor,
      limit: Number(limit) || 50,
    });
  }

  @Get("org-chart")
  @RequirePlatformPermission("directory.read")
  orgChart() {
    return this.people.orgChart();
  }

  @Get("directory/:userId")
  @RequirePlatformPermission("directory.read")
  profile(@Param("userId") userId: string, @Req() req: { platformAccess?: EffectiveAccess }) {
    return this.people.profile(userId, req.platformAccess);
  }

  @Patch("directory/:userId")
  @RequirePlatformPermission("directory.manage")
  update(@CurrentUser() user: JwtPayload, @Param("userId") userId: string, @Body() dto: UpdateEmployeeDto) {
    return this.people.updateEmployee(user, userId, dto);
  }

  @Post("directory/:userId/offboard")
  @RequirePlatformPermission("team.manage")
  offboard(@CurrentUser() user: JwtPayload, @Param("userId") userId: string, @Body() dto: OffboardDto) {
    return this.people.offboard(user, userId, dto);
  }

  @Delete("directory/:userId")
  @RequirePlatformPermission("team.manage")
  remove(@CurrentUser() user: JwtPayload, @Param("userId") userId: string, @Body() dto: OffboardDto) {
    return this.people.remove(user, userId, dto ?? {});
  }

  @Post("bulk-invite")
  @RequirePlatformPermission("team.manage")
  bulkInvite(@CurrentUser() user: JwtPayload, @Body() dto: BulkInviteDto) {
    return this.people.bulkInvite(user, dto.rows);
  }

  @Get("shifts")
  @RequirePlatformPermission("directory.read")
  shifts(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("teamId") teamId?: string,
    @Query("userId") userId?: string,
  ) {
    return this.people.listShifts({ from, to, teamId, userId });
  }

  @Post("shifts")
  @RequirePlatformPermission("shifts.manage")
  createShift(@Body() dto: ShiftDto) {
    return this.people.createShift(dto);
  }

  @Delete("shifts/:id")
  @RequirePlatformPermission("shifts.manage")
  deleteShift(@Param("id") id: string) {
    return this.people.deleteShift(id);
  }

  @Get("rotations")
  @RequirePlatformPermission("directory.read", "tickets.read")
  rotations() {
    return this.people.listRotations();
  }

  @Post("rotations")
  @RequirePlatformPermission("shifts.manage")
  createRotation(@Body() dto: RotationDto) {
    return this.people.upsertRotation(null, dto);
  }

  @Patch("rotations/:id")
  @RequirePlatformPermission("shifts.manage")
  updateRotation(@Param("id") id: string, @Body() dto: RotationDto) {
    return this.people.upsertRotation(id, dto);
  }

  @Delete("rotations/:id")
  @RequirePlatformPermission("shifts.manage")
  deleteRotation(@Param("id") id: string) {
    return this.people.deleteRotation(id);
  }
}

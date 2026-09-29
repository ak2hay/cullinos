import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, RequirePlatformPermission } from "../../common/decorators";
import { PLATFORM_ROLES } from "../../common/platform-permissions";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import { PlatformTeamService } from "./platform-team.service";

class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(PLATFORM_ROLES)
  platformRole!: string;
}

class ChangeRoleDto {
  @IsIn(PLATFORM_ROLES)
  platformRole!: string;
}

class DeactivateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@Controller("super-admin/team")
@UseGuards(SuperAdminGuard)
@RequirePlatformPermission("team.manage")
export class PlatformTeamController {
  constructor(private team: PlatformTeamService) {}

  @Get()
  list() {
    return this.team.list();
  }

  @Get("roles")
  roles() {
    return this.team.roles();
  }

  @Post()
  invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteStaffDto) {
    return this.team.invite(user, dto);
  }

  @Patch(":id/role")
  changeRole(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.team.changeRole(user, id, dto.platformRole);
  }

  @Patch(":id/deactivate")
  deactivate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: DeactivateStaffDto,
  ) {
    return this.team.deactivate(user, id, dto?.reason);
  }

  @Patch(":id/activate")
  activate(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.team.activate(user, id);
  }

  @Post(":id/reset-password")
  resetPassword(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.team.resetPassword(user, id);
  }
}

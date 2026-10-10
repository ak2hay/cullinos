import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
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
import { PlatformSupportService } from "./platform-support.service";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;

class CreateTicketDto {
  @IsString() @MinLength(4) @MaxLength(200) subject!: string;
  @IsString() @MinLength(4) @MaxLength(10_000) description!: string;
  @IsOptional() @IsString() organizationId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: (typeof PRIORITIES)[number];
  @IsOptional() @IsString() @MaxLength(120) requesterName?: string;
  @IsOptional() @IsEmail() requesterEmail?: string;
  @IsOptional() @IsString() @MaxLength(20) requesterPhone?: string;
  @IsOptional() @IsString() assigneeTeamId?: string | null;
  @IsOptional() @IsString() assigneeUserId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
}

class UpdateTicketDto {
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsIn(PRIORITIES) priority?: (typeof PRIORITIES)[number];
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() assigneeUserId?: string | null;
  @IsOptional() @IsString() assigneeTeamId?: string | null;
}

class AttachmentDto {
  @IsString() @MaxLength(200) name!: string;
  @IsUrl({ require_tld: false }) url!: string;
}

class CommentDto {
  @IsString() @MinLength(1) @MaxLength(10_000) body!: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

class GrantRequestDto {
  @IsIn(["read_only", "full"]) accessLevel!: "read_only" | "full";
  @IsInt() @Min(15) @Max(480) durationMinutes!: number;
  @IsString() @MinLength(15) @MaxLength(2000) justification!: string;
}

type Req = { platformAccess?: EffectiveAccess };

@Controller("super-admin/support")
@UseGuards(SuperAdminGuard)
export class PlatformSupportController {
  constructor(private support: PlatformSupportService) {}

  @Get("tickets")
  @RequirePlatformPermission("tickets.read")
  list(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("assignee") assignee?: string,
    @Query("teamId") teamId?: string,
    @Query("organizationId") organizationId?: string,
    @Query("q") q?: string,
    @Query("breached") breached?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.support.listTickets(user, {
      status,
      priority,
      assignee,
      teamId,
      organizationId,
      q,
      breached: breached === "true",
      cursor,
      limit: Number(limit) || 50,
    });
  }

  @Post("tickets")
  @RequirePlatformPermission("tickets.write")
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(user, dto);
  }

  @Get("tickets/:id")
  @RequirePlatformPermission("tickets.read")
  get(@Param("id") id: string) {
    return this.support.getTicket(id);
  }

  @Patch("tickets/:id")
  @RequirePlatformPermission("tickets.write")
  update(
    @CurrentUser() user: JwtPayload,
    @Req() req: Req,
    @Param("id") id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.support.updateTicket(user, req.platformAccess, id, dto);
  }

  @Post("tickets/:id/comments")
  @RequirePlatformPermission("tickets.write")
  comment(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: CommentDto) {
    return this.support.addComment(user, id, dto);
  }

  @Post("tickets/:id/access-grants")
  @RequirePlatformPermission("tenants.impersonate")
  requestGrant(
    @CurrentUser() user: JwtPayload,
    @Req() req: Req,
    @Param("id") id: string,
    @Body() dto: GrantRequestDto,
  ) {
    return this.support.requestGrant(user, req.platformAccess, id, dto);
  }

  @Get("access-grants")
  @RequirePlatformPermission("tenants.impersonate", "tenant_access.revoke", "tickets.read")
  grants(
    @CurrentUser() user: JwtPayload,
    @Req() req: Req,
    @Query("status") status?: string,
    @Query("mine") mine?: string,
    @Query("organizationId") organizationId?: string,
  ) {
    return this.support.listGrants(user, req.platformAccess, {
      status,
      mine: mine === "true",
      organizationId,
    });
  }

  @Post("access-grants/:id/revoke")
  @RequirePlatformPermission("tenants.impersonate", "tenant_access.revoke")
  revoke(@CurrentUser() user: JwtPayload, @Req() req: Req, @Param("id") id: string) {
    return this.support.revokeGrant(user, req.platformAccess, id);
  }
}

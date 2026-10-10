import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
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
import { CurrentUser, OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { TICKET_CATEGORIES, TenantSupportService, type TenantActor } from "./tenant-support.service";

class TenantAttachmentDto {
  @IsString() @MaxLength(200) name!: string;
  @IsUrl({ require_protocol: true }) url!: string;
}

class TenantCreateTicketDto {
  @IsString() @MinLength(4) @MaxLength(200) subject!: string;
  @IsString() @MinLength(10) @MaxLength(10_000) description!: string;
  @IsOptional() @IsIn(TICKET_CATEGORIES) category?: string;
  @IsOptional() @IsIn(["low", "normal", "high"]) priority?: "low" | "normal" | "high";
  @IsOptional() @IsString() @MaxLength(20) requesterPhone?: string;
}

class TenantCommentDto {
  @IsString() @MinLength(1) @MaxLength(10_000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => TenantAttachmentDto)
  attachments?: TenantAttachmentDto[];
}

class TenantStatusDto {
  @IsIn(["close", "reopen"]) action!: "close" | "reopen";
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

class TenantRateDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

/** Restaurant-facing support portal. Scoped to the caller's organization via the org JWT. */
@Controller("support")
@RequirePermissions("org:read", "settings:read")
export class TenantSupportController {
  constructor(private support: TenantSupportService) {}

  private actor(user: JwtPayload, orgId: string): TenantActor {
    // Platform staff work tickets from the agent workspace, not as a tenant.
    if (user.isSuperAdmin && !user.impersonation) {
      throw new ForbiddenException("Use the agent workspace for platform staff accounts");
    }
    return { sub: user.sub, organizationId: orgId };
  }

  @Get("tickets")
  list(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("mine") mine?: string,
  ) {
    return this.support.list(this.actor(user, orgId), { status, q, mine: mine === "true" });
  }

  @Post("tickets")
  create(@CurrentUser() user: JwtPayload, @OrgId() orgId: string, @Body() dto: TenantCreateTicketDto) {
    return this.support.create(this.actor(user, orgId), dto);
  }

  @Get("tickets/:id")
  get(@CurrentUser() user: JwtPayload, @OrgId() orgId: string, @Param("id") id: string) {
    return this.support.get(this.actor(user, orgId), id);
  }

  @Post("tickets/:id/comments")
  comment(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() dto: TenantCommentDto,
  ) {
    return this.support.comment(this.actor(user, orgId), id, dto);
  }

  @Post("tickets/:id/status")
  status(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() dto: TenantStatusDto,
  ) {
    return this.support.setStatus(this.actor(user, orgId), id, dto.action, dto.reason);
  }

  @Post("tickets/:id/rating")
  rate(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() dto: TenantRateDto,
  ) {
    return this.support.rate(this.actor(user, orgId), id, dto.rating, dto.comment);
  }

  @Get("articles")
  articles(@Query("q") q?: string, @Query("category") category?: string) {
    return this.support.listArticles({ q, category });
  }

  @Get("articles/:slug")
  article(@Param("slug") slug: string) {
    return this.support.getArticle(slug);
  }
}

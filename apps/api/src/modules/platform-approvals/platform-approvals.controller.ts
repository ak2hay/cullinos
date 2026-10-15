import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Throttle } from "@nestjs/throttler";
import type { JwtPayload } from "@cullinos/auth";
import {
  AnyPlatformStaff,
  CurrentUser,
  Public,
  RequirePlatformPermission,
  SkipActivityLog,
  SkipStepUp,
} from "../../common/decorators";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import type { EffectiveAccess } from "../platform-iam/platform-access.util";
import type { PolicyCondition } from "./approval.util";
import { PlatformApprovalsService } from "./platform-approvals.service";

class DecisionDto {
  @IsIn(["approved", "rejected"]) decision!: "approved" | "rejected";
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

class PolicyDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(5) requiredApprovals?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) approverRoleKeys?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) approverTeamIds?: string[];
  @IsOptional() @IsBoolean() blockSelfApproval?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(720) expiryHours?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) conditions?: PolicyCondition[] | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

type Req = { platformAccess?: EffectiveAccess };

function canSeeAll(req: Req) {
  return Boolean(req.platformAccess?.global.includes("approvals.read_all") || req.platformAccess?.isOwner);
}

@Controller("super-admin")
@UseGuards(SuperAdminGuard)
export class PlatformApprovalsController {
  constructor(private approvals: PlatformApprovalsService) {}

  @Get("approvals")
  @AnyPlatformStaff()
  list(
    @CurrentUser() user: JwtPayload,
    @Req() req: Req,
    @Query("box") box?: string,
    @Query("status") status?: string,
    @Query("actionKey") actionKey?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const b = box === "mine" || box === "all" ? box : "pending_for_me";
    return this.approvals.list(
      user,
      { box: b, status, actionKey, cursor, limit: Number(limit) || 50 },
      canSeeAll(req),
    );
  }

  @Get("approvals/count")
  @AnyPlatformStaff()
  @SkipActivityLog()
  count(@CurrentUser() user: JwtPayload) {
    return this.approvals.pendingCountFor(user);
  }

  @Get("approvals/:id")
  @AnyPlatformStaff()
  get(@CurrentUser() user: JwtPayload, @Req() req: Req, @Param("id") id: string) {
    return this.approvals.get(user, id, canSeeAll(req));
  }

  @Post("approvals/:id/decision")
  @AnyPlatformStaff()
  decide(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: DecisionDto) {
    return this.approvals.decide(user, id, dto.decision, dto.comment);
  }

  @Post("approvals/:id/cancel")
  @AnyPlatformStaff()
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.approvals.cancel(user, id);
  }

  @Get("approvals/:id/replay")
  @AnyPlatformStaff()
  replay(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.approvals.replay(user, id);
  }

  @Get("approval-policies")
  @RequirePlatformPermission("approvals.policies", "approvals.read_all")
  policies() {
    return this.approvals.listPolicies();
  }

  @Patch("approval-policies/:id")
  @RequirePlatformPermission("approvals.policies")
  updatePolicy(@Param("id") id: string, @Body() dto: PolicyDto) {
    return this.approvals.updatePolicy(id, dto);
  }
}

class EmailTokenDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
}

class EmailDecisionDto extends EmailTokenDto {
  @IsIn(["approved", "rejected"]) decision!: "approved" | "rejected";
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

/** Approve / reject from the emailed one-time link; the token itself is the credential. */
@Controller("super-admin/approvals/email-action")
@Public()
@SkipStepUp()
@SkipActivityLog()
export class ApprovalEmailActionController {
  constructor(private approvals: PlatformApprovalsService) {}

  @Post("preview")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  preview(@Body() dto: EmailTokenDto) {
    return this.approvals.emailActionPreview(dto.token);
  }

  @Post("decide")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  decide(@Body() dto: EmailDecisionDto) {
    return this.approvals.decideFromEmail(dto.token, dto.decision, dto.comment);
  }
}

import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import {
  AnyPlatformStaff,
  CurrentUser,
  RequirePlatformPermission,
  SkipActivityLog,
} from "../../common/decorators";
import { SuperAdminGuard } from "../marketing/guards/super-admin.guard";
import type { EffectiveAccess } from "../platform-iam/platform-access.util";
import {
  BULK_ACTIONS,
  EXPORT_KINDS,
  PlatformReportsService,
  type BulkAction,
  type ExportKind,
} from "./platform-reports.service";

class SavedViewDto {
  @IsString() @MinLength(1) @MaxLength(60) page!: string;
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsObject() filters!: Record<string, unknown>;
  @IsOptional() @IsBoolean() isShared?: boolean;
}

class ExportDto {
  @IsIn(EXPORT_KINDS as unknown as string[]) exportKind!: ExportKind;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(2000) justification?: string;
}

class BulkDto {
  @IsIn(BULK_ACTIONS as unknown as string[]) action!: BulkAction;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @IsString({ each: true }) organizationIds!: string[];
  @IsString() @MinLength(8) @MaxLength(500) reason!: string;
  @IsOptional() @IsString() @MaxLength(2000) justification?: string;
}

type Req = { platformAccess?: EffectiveAccess };

function decodeHeader(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

@Controller("super-admin/reports")
@UseGuards(SuperAdminGuard)
export class PlatformReportsController {
  constructor(private reports: PlatformReportsService) {}

  @Get("overview")
  @RequirePlatformPermission("reports.read")
  overview() {
    return this.reports.overview();
  }

  @Get("views")
  @AnyPlatformStaff()
  @SkipActivityLog()
  views(@CurrentUser() user: JwtPayload, @Query("page") page: string) {
    return this.reports.listViews(user, page ?? "");
  }

  @Post("views")
  @AnyPlatformStaff()
  createView(@CurrentUser() user: JwtPayload, @Body() dto: SavedViewDto) {
    return this.reports.createView(user, dto);
  }

  @Delete("views/:id")
  @AnyPlatformStaff()
  deleteView(@CurrentUser() user: JwtPayload, @Req() req: Req, @Param("id") id: string) {
    return this.reports.deleteView(user, id, Boolean(req.platformAccess?.isOwner));
  }

  @Post("exports")
  @RequirePlatformPermission("reports.export")
  createExport(
    @CurrentUser() user: JwtPayload,
    @Req() req: Req,
    @Body() dto: ExportDto,
    @Headers("x-approval-justification") justificationHeader?: string,
  ) {
    return this.reports.createExport(user, req.platformAccess, {
      ...dto,
      justification: dto.justification || decodeHeader(justificationHeader),
    });
  }

  @Post("bulk")
  @RequirePlatformPermission("bulk.run")
  createBulk(
    @CurrentUser() user: JwtPayload,
    @Req() req: Req,
    @Body() dto: BulkDto,
    @Headers("x-approval-justification") justificationHeader?: string,
  ) {
    return this.reports.createBulk(user, req.platformAccess, {
      ...dto,
      justification: dto.justification || decodeHeader(justificationHeader),
    });
  }

  @Get("jobs")
  @RequirePlatformPermission("reports.export", "bulk.run")
  jobs(@CurrentUser() user: JwtPayload, @Req() req: Req) {
    return this.reports.listJobs(user, Boolean(req.platformAccess?.isOwner));
  }

  @Get("jobs/:id/download")
  @RequirePlatformPermission("reports.export")
  download(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reports.download(user, id);
  }

  @Post("jobs/:id/cancel")
  @RequirePlatformPermission("reports.export", "bulk.run")
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reports.cancel(user, id);
  }
}

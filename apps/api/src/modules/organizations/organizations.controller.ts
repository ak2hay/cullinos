import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import {
  MARKETING_UPLOAD_MAX_BYTES,
  marketingImageFileFilter,
  MarketingUploadService,
  uploadMaxBytesFor,
} from "../marketing/marketing-upload.service";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(
    private service: OrganizationsService,
    private uploadService: MarketingUploadService,
  ) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("current")
  current(@OrgId() orgId: string) {
    return this.service.get(orgId);
  }

  @Get("settings")
  @RequireModule("settings")
  getSettings(@OrgId() orgId: string) {
    return this.service.getSettings(orgId);
  }

  @Patch("settings")
  @RequireModule("settings")
  @RequirePermissions("settings:update", "org:update", "org:manage_settings")
  updateSettings(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.updateSettings(orgId, body);
  }

  @Patch("current")
  @RequireModule("settings")
  @RequirePermissions("settings:update", "org:update")
  updateCurrent(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.update(orgId, body);
  }

  @Post("logo-upload")
  @RequireModule("settings")
  @RequirePermissions("settings:update", "org:update")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
      fileFilter: marketingImageFileFilter,
    }),
  )
  async uploadLogo(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    const result = await this.uploadService.saveUploadedFile(
      file,
      {
        scope: "org",
        orgId,
        leafName: "logo",
        imageSlot: "orgLogo",
      },
      uploadMaxBytesFor(user),
    );
    await this.service.update(orgId, { logoUrl: result.url });
    return { logoUrl: result.url, url: result.url };
  }
}

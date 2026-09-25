import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  MarketingUploadService,
  uploadMaxBytesFor,
} from "../marketing/marketing-upload.service";
import { CouponsService } from "./coupons.service";

@Controller("coupons")
export class CouponsController {
  constructor(
    private service: CouponsService,
    private uploadService: MarketingUploadService,
  ) {}

  @Get()
  @RequirePermissions("settings:read", "org:read")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post("upload-image")
  @RequireModule("loyalty")
  @RequirePermissions("settings:update", "org:manage_settings")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
    }),
  )
  async uploadImage(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    const result = await this.uploadService.saveUploadedFile(
      file,
      `coupon-${orgId}-${Date.now()}`,
      "coupon",
      uploadMaxBytesFor(user),
    );
    return { imageUrl: result.url };
  }

  @Post()
  @RequireModule("loyalty")
  @RequirePermissions("settings:update", "org:manage_settings")
  create(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.create(orgId, body as never);
  }

  @Patch(":id")
  @RequireModule("loyalty")
  @RequirePermissions("settings:update", "org:manage_settings")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(orgId, id, body as never);
  }

  @Post(":id/deactivate")
  @RequireModule("loyalty")
  @RequirePermissions("settings:update", "org:manage_settings")
  deactivate(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deactivate(orgId, id);
  }

  @Delete(":id")
  @RequireModule("loyalty")
  @RequirePermissions("settings:update", "org:manage_settings")
  remove(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.remove(orgId, id);
  }

  @Post("validate")
  @RequireModule("loyalty")
  @RequirePermissions("settings:read", "org:read", "pos:access")
  validate(
    @OrgId() orgId: string,
    @Body("code") code: string,
    @Query("orderTotal") orderTotal?: string,
    @Body("orderTotal") bodyTotal?: number,
  ) {
    return this.service.validate(orgId, code, Number(orderTotal ?? bodyTotal ?? 0));
  }
}

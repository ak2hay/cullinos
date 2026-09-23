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
import { randomUUID } from "crypto";
import { memoryStorage } from "multer";
import type { JwtPayload } from "@cullinos/auth";
import {
  CurrentUser,
  OrgId,
  RequireModule,
} from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import {
  MARKETING_UPLOAD_MAX_BYTES,
  MarketingUploadService,
} from "../marketing/marketing-upload.service";
import { OrgRolesService } from "../organizations/org-roles.service";
import { OutletAccessService } from "./outlet-access.service";
import { OutletsService } from "./outlets.service";

@Controller("outlets")
export class OutletsController {
  constructor(
    private service: OutletsService,
    private uploadService: MarketingUploadService,
    private outletAccess: OutletAccessService,
    private orgRoles: OrgRolesService,
  ) {}

  @Get()
  async list(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query("brandId") brandId?: string,
  ) {
    // Sync system role permissions (e.g. newly added outlet:update) for existing orgs.
    await this.orgRoles.ensureSystemRoles(orgId);
    const outlets = await this.service.list(orgId, brandId);
    const allowed = await this.outletAccess.allowedOutletIds(user.sub, orgId);
    if (!allowed) return outlets;
    return outlets.filter((o) => allowed.has(o.id));
  }

  @Post()
  @RequireModule("settings")
  @RequirePermissions("outlet:create", "settings:update")
  create(
    @OrgId() orgId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.create(orgId, {
      name: body.name as string,
      city: body.city as string | undefined,
      phone: body.phone as string | undefined,
      gstin: body.gstin as string | undefined,
      operatingMode: body.operatingMode as string | undefined,
    });
  }

  @Patch(":id")
  @RequireModule("settings")
  @RequirePermissions("outlet:update", "settings:update")
  async update(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletAccess.assertCanAccessOutlet(user.sub, orgId, id);
    return this.service.update(orgId, id, body);
  }

  /**
   * Upload a cover image for the outlet.
   * Returns { coverImageUrl } which is then saved via PATCH /:id.
   */
  @Post(":id/cover-upload")
  @RequireModule("settings")
  @RequirePermissions("outlet:update", "settings:update")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
    }),
  )
  async uploadCover(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    await this.outletAccess.assertCanAccessOutlet(user.sub, orgId, id);
    const result = await this.uploadService.saveUploadedFile(
      file,
      `outlet-cover-${id}`,
      "outletCover",
    );
    const updated = await this.service.update(orgId, id, { coverImageUrl: result.url });
    return { coverImageUrl: updated.coverImageUrl, url: result.url };
  }

  @Get(":id/photos")
  @RequirePermissions("outlet:read", "settings:read", "outlet:update", "org:read")
  async listPhotos(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    await this.outletAccess.assertCanAccessOutlet(user.sub, orgId, id);
    return this.service.listPhotos(orgId, id);
  }

  @Post(":id/photos/upload")
  @RequireModule("settings")
  @RequirePermissions("outlet:update", "settings:update")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
    }),
  )
  async uploadPhoto(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("caption") caption?: string,
    @Body("setAsCover") setAsCover?: string,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    await this.outletAccess.assertCanAccessOutlet(user.sub, orgId, id);
    const result = await this.uploadService.saveUploadedFile(
      file,
      `outlet-photo-${id}-${randomUUID()}`,
      "outletGallery",
    );
    const photo = await this.service.addPhoto(orgId, id, {
      url: result.url,
      caption,
      setAsCover: setAsCover === "true" || setAsCover === "1",
    });
    return photo;
  }

  @Post(":id/photos/reorder")
  @RequireModule("settings")
  @RequirePermissions("outlet:update", "settings:update")
  async reorderPhotos(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { photoIds?: string[] },
  ) {
    await this.outletAccess.assertCanAccessOutlet(user.sub, orgId, id);
    return this.service.reorderPhotos(orgId, id, body.photoIds ?? []);
  }

  @Post(":id/photos/:photoId/set-cover")
  @RequireModule("settings")
  @RequirePermissions("outlet:update", "settings:update")
  async setCover(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("photoId") photoId: string,
  ) {
    await this.outletAccess.assertCanAccessOutlet(user.sub, orgId, id);
    return this.service.setCoverFromPhoto(orgId, id, photoId);
  }

  @Delete(":id/photos/:photoId")
  @RequireModule("settings")
  @RequirePermissions("outlet:update", "settings:update")
  async deletePhoto(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("photoId") photoId: string,
  ) {
    await this.outletAccess.assertCanAccessOutlet(user.sub, orgId, id);
    return this.service.deletePhoto(orgId, id, photoId);
  }
}

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

import { OrgId, Public, RequireModule } from "../../common/decorators";
import {
  MARKETING_UPLOAD_MAX_BYTES,
  MarketingUploadService,
} from "../marketing/marketing-upload.service";
import { PromoDisplayService, type SlideInput } from "./promo-display.service";

@Controller("promo-display")
export class PromoDisplayController {
  constructor(
    private service: PromoDisplayService,
    private uploadService: MarketingUploadService,
  ) {}

  @Get()
  @RequireModule("settings")
  list(@OrgId() orgId: string, @Query("outletId") outletId: string) {
    return this.service.list(orgId, outletId);
  }

  @Post("slides/upload-image")
  @RequireModule("settings")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
    }),
  )
  async uploadSlideImage(
    @OrgId() orgId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    const result = await this.uploadService.saveUploadedFile(
      file,
      `promo-slide-${orgId}-${Date.now()}`,
      "promoSlide",
    );
    return { imageUrl: result.url };
  }

  @Post()
  @RequireModule("settings")
  create(
    @OrgId() orgId: string,
    @Body() body: SlideInput & { outletId: string },
  ) {
    return this.service.create(orgId, body.outletId, body);
  }

  @Patch(":id")
  @RequireModule("settings")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: SlideInput,
  ) {
    return this.service.update(orgId, id, body);
  }

  @Delete(":id")
  @RequireModule("settings")
  remove(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.remove(orgId, id);
  }
}

@Controller("public/promo-display")
export class PublicPromoDisplayController {
  constructor(private service: PromoDisplayService) {}

  @Public()
  @Get("playlist")
  playlist(
    @Query("orgSlug") orgSlug: string,
    @Query("outletSlug") outletSlug: string,
  ) {
    return this.service.publicPlaylist(orgSlug, outletSlug);
  }

  /**
   * POST /public/promo-display/heartbeat
   * Called every 60 s by public display pages (pickup / CDS / playlist).
   * Body: { orgSlug, outletSlug, mode }
   */
  @Public()
  @Post("heartbeat")
  heartbeat(
    @Body() body: { orgSlug: string; outletSlug: string; mode: string },
  ) {
    return this.service.publicHeartbeat(body.orgSlug, body.outletSlug, body.mode);
  }
}

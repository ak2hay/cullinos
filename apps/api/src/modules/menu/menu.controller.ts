import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, Public, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import {
  MARKETING_UPLOAD_MAX_BYTES,
  MarketingUploadService,
  marketingImageFileFilter,
  uploadMaxBytesFor,
} from "../marketing/marketing-upload.service";
import { MenuService } from "./menu.service";

@Controller("menu")
@RequirePermissions("menu:read")
export class MenuController {
  constructor(
    private service: MenuService,
    private uploadService: MarketingUploadService,
  ) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("categories")
  @RequireModule("menu")
  listCategories(@OrgId() orgId: string) {
    return this.service.listCategories(orgId);
  }

  @Get("kitchen-stations")
  @RequireModule("menu")
  listKitchenStations(@OrgId() orgId: string) {
    return this.service.listKitchenStations(orgId);
  }

  @Post("categories")
  @RequireModule("menu")
  @RequirePermissions("menu:create")
  createCategory(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createCategory(orgId, body as never);
  }

  @Patch("categories/:id")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  updateCategory(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateCategory(orgId, id, body as never);
  }

  @Delete("categories/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  deleteCategory(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteCategory(orgId, id);
  }

  @Get("items")
  @RequireModule("menu")
  listItems(@OrgId() orgId: string) {
    return this.service.listItems(orgId);
  }

  @Get("items/:id")
  @RequireModule("menu")
  getItem(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.getItem(orgId, id);
  }

  @Post("items")
  @RequireModule("menu")
  @RequirePermissions("menu:create")
  createItem(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createItem(orgId, body as never);
  }

  @Patch("items/:id")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  updateItem(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateItem(orgId, id, body as never);
  }

  @Post("items/:id/image-upload")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
      fileFilter: marketingImageFileFilter,
    }),
  )
  async uploadItemImage(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    const result = await this.uploadService.saveUploadedFile(
      file,
      {
        scope: "org",
        orgId,
        entityId: id,
        leafName: id,
        imageSlot: "menuItem",
      },
      uploadMaxBytesFor(user),
    );
    await this.service.setItemImageUrl(orgId, id, result.url);
    return { imageUrl: result.url, url: result.url };
  }

  @Delete("items/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  deleteItem(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteItem(orgId, id);
  }

  @Get("schedules")
  @RequireModule("menu")
  listSchedules(@OrgId() orgId: string) {
    return this.service.listSchedules(orgId);
  }

  @Post("schedules")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  createSchedule(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createSchedule(orgId, body as never);
  }

  @Patch("schedules/:id")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  updateSchedule(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateSchedule(orgId, id, body as never);
  }

  @Delete("schedules/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  deleteSchedule(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteSchedule(orgId, id);
  }

  @Get("combos")
  @RequireModule("menu")
  listCombos(@OrgId() orgId: string) {
    return this.service.listCombos(orgId);
  }

  @Post("combos")
  @RequireModule("menu")
  @RequirePermissions("menu:create")
  createCombo(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createCombo(orgId, body as never);
  }

  @Patch("combos/:id")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  updateCombo(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateCombo(orgId, id, body as never);
  }

  @Delete("combos/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  deleteCombo(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.deleteCombo(orgId, id);
  }

  @Get("outlets/:outletId")
  @RequireModule("menu")
  getOutletMenu(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.getOutletMenu(orgId, outletId);
  }

  @Get("outlets/:outletId/prices")
  @RequireModule("menu")
  listOutletPrices(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.listOutletPrices(orgId, outletId);
  }

  @Post("outlets/:outletId/items/:menuItemId/prices")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  setOutletPrice(
    @OrgId() orgId: string,
    @Param("outletId") outletId: string,
    @Param("menuItemId") menuItemId: string,
    @Body()
    body: {
      price: number;
      priceType?: "retail" | "wholesale";
      isAvailable?: boolean;
    },
  ) {
    return this.service.setOutletPrice(
      orgId,
      outletId,
      menuItemId,
      body.price,
      body.priceType ?? "retail",
      body.isAvailable,
    );
  }
}

@Controller("public/menu")
export class PublicMenuController {
  constructor(private service: MenuService) {}

  @Public()
  @Get("outlets/:outletId")
  getOutletMenu(@Param("outletId") outletId: string) {
    return this.service.getOutletMenuPublic(outletId);
  }
}

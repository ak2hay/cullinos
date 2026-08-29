import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@cullinos/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MenuService } from './menu.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateKitchenStationDto,
  UpdateKitchenStationDto,
  UpsertOutletPriceDto,
} from './dto/menu.dto';

interface AuthUser {
  sub: string;
  organizationId: string;
  permissions: string[];
}

@Controller('menu')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // Categories
  @Get('categories')
  @RequirePermissions(PERMISSIONS.MENU_READ)
  listCategories(@CurrentUser() user: AuthUser) {
    return this.menuService.listCategories(user.organizationId);
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.MENU_CREATE)
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(user.organizationId, user.sub, dto);
  }

  @Patch('categories/:id')
  @RequirePermissions(PERMISSIONS.MENU_UPDATE)
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(user.organizationId, user.sub, id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions(PERMISSIONS.MENU_DELETE)
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.menuService.deleteCategory(user.organizationId, user.sub, id);
  }

  // Menu Items
  @Get('items')
  @RequirePermissions(PERMISSIONS.MENU_READ)
  listMenuItems(@CurrentUser() user: AuthUser) {
    return this.menuService.listMenuItems(user.organizationId);
  }

  @Get('items/:id')
  @RequirePermissions(PERMISSIONS.MENU_READ)
  getMenuItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.menuService.getMenuItem(user.organizationId, id);
  }

  @Post('items')
  @RequirePermissions(PERMISSIONS.MENU_CREATE)
  createMenuItem(@CurrentUser() user: AuthUser, @Body() dto: CreateMenuItemDto) {
    return this.menuService.createMenuItem(user.organizationId, user.sub, dto);
  }

  @Patch('items/:id')
  @RequirePermissions(PERMISSIONS.MENU_UPDATE)
  updateMenuItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateMenuItem(user.organizationId, user.sub, id, dto);
  }

  @Delete('items/:id')
  @RequirePermissions(PERMISSIONS.MENU_DELETE)
  deleteMenuItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.menuService.deleteMenuItem(user.organizationId, user.sub, id);
  }

  // Kitchen Stations
  @Get('outlets/:outletId/kitchen-stations')
  @RequirePermissions(PERMISSIONS.MENU_READ)
  listKitchenStations(@Param('outletId') outletId: string) {
    return this.menuService.listKitchenStations(outletId);
  }

  @Post('outlets/:outletId/kitchen-stations')
  @RequirePermissions(PERMISSIONS.MENU_CREATE)
  createKitchenStation(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Body() dto: CreateKitchenStationDto,
  ) {
    return this.menuService.createKitchenStation(user.organizationId, outletId, user.sub, dto);
  }

  @Patch('outlets/:outletId/kitchen-stations/:id')
  @RequirePermissions(PERMISSIONS.MENU_UPDATE)
  updateKitchenStation(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKitchenStationDto,
  ) {
    return this.menuService.updateKitchenStation(user.organizationId, outletId, user.sub, id, dto);
  }

  @Delete('outlets/:outletId/kitchen-stations/:id')
  @RequirePermissions(PERMISSIONS.MENU_DELETE)
  deleteKitchenStation(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
  ) {
    return this.menuService.deleteKitchenStation(user.organizationId, outletId, user.sub, id);
  }

  // Outlet Menu
  @Get('outlets/:outletId')
  @RequirePermissions(PERMISSIONS.MENU_READ)
  getOutletMenu(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
  ) {
    return this.menuService.getOutletMenu(outletId, user.organizationId);
  }

  @Post('outlets/:outletId/prices')
  @RequirePermissions(PERMISSIONS.MENU_UPDATE)
  upsertOutletPrice(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Body() dto: UpsertOutletPriceDto,
  ) {
    return this.menuService.upsertOutletPrice(user.organizationId, outletId, user.sub, dto);
  }
}

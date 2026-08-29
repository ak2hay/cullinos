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
import { TablesService } from './tables.service';
import {
  CreateFloorDto,
  UpdateFloorDto,
  CreateSectionDto,
  UpdateSectionDto,
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
  MergeTablesDto,
  TransferTableDto,
} from './dto/tables.dto';

interface AuthUser {
  sub: string;
  organizationId: string;
}

@Controller('tables')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get('outlets/:outletId/floors')
  @RequirePermissions(PERMISSIONS.TABLE_READ)
  listFloors(@CurrentUser() user: AuthUser, @Param('outletId') outletId: string) {
    return this.tablesService.listFloors(outletId, user.organizationId);
  }

  @Post('outlets/:outletId/floors')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  createFloor(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Body() dto: CreateFloorDto,
  ) {
    return this.tablesService.createFloor(user.organizationId, outletId, user.sub, dto);
  }

  @Patch('outlets/:outletId/floors/:id')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  updateFloor(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.tablesService.updateFloor(user.organizationId, outletId, user.sub, id, dto);
  }

  @Delete('outlets/:outletId/floors/:id')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  deleteFloor(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
  ) {
    return this.tablesService.deleteFloor(user.organizationId, outletId, user.sub, id);
  }

  @Get('floors/:floorId/sections')
  @RequirePermissions(PERMISSIONS.TABLE_READ)
  listSections(@Param('floorId') floorId: string) {
    return this.tablesService.listSections(floorId);
  }

  @Post('outlets/:outletId/floors/:floorId/sections')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  createSection(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('floorId') floorId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.tablesService.createSection(user.organizationId, outletId, floorId, user.sub, dto);
  }

  @Patch('outlets/:outletId/sections/:id')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  updateSection(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.tablesService.updateSection(user.organizationId, outletId, user.sub, id, dto);
  }

  @Delete('outlets/:outletId/sections/:id')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  deleteSection(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
  ) {
    return this.tablesService.deleteSection(user.organizationId, outletId, user.sub, id);
  }

  @Get('outlets/:outletId')
  @RequirePermissions(PERMISSIONS.TABLE_READ)
  listTables(@CurrentUser() user: AuthUser, @Param('outletId') outletId: string) {
    return this.tablesService.listTables(outletId, user.organizationId);
  }

  @Post('outlets/:outletId')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  createTable(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.tablesService.createTable(user.organizationId, outletId, user.sub, dto);
  }

  @Patch('outlets/:outletId/:id')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  updateTable(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.updateTable(user.organizationId, outletId, user.sub, id, dto);
  }

  @Delete('outlets/:outletId/:id')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  deleteTable(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
  ) {
    return this.tablesService.deleteTable(user.organizationId, outletId, user.sub, id);
  }

  @Patch('outlets/:outletId/:id/status')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  updateTableStatus(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tablesService.updateTableStatus(user.organizationId, outletId, user.sub, id, dto);
  }

  @Post('outlets/:outletId/:id/qr-code')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  generateQrCode(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Param('id') id: string,
  ) {
    return this.tablesService.generateQrCode(user.organizationId, outletId, user.sub, id);
  }

  @Post('outlets/:outletId/merge')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  mergeTables(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Body() dto: MergeTablesDto,
  ) {
    return this.tablesService.mergeTables(user.organizationId, outletId, user.sub, dto);
  }

  @Post('outlets/:outletId/transfer')
  @RequirePermissions(PERMISSIONS.TABLE_MANAGE)
  transferTable(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Body() dto: TransferTableDto,
  ) {
    return this.tablesService.transferTable(user.organizationId, outletId, user.sub, dto);
  }
}

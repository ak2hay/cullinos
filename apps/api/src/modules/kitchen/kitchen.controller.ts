import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@cullinos/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KitchenService } from './kitchen.service';
import { UpdateKitchenItemStatusDto } from './dto/kitchen.dto';

interface AuthUser {
  sub: string;
  organizationId: string;
}

@Controller('kitchen')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('outlets/:outletId/display')
  @RequirePermissions(PERMISSIONS.KITCHEN_READ)
  getDisplayData(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Query('stationId') stationId?: string,
  ) {
    return this.kitchenService.getDisplayData(outletId, user.organizationId, stationId);
  }

  @Patch('items/:itemId/status')
  @RequirePermissions(PERMISSIONS.KITCHEN_UPDATE)
  updateItemStatus(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateKitchenItemStatusDto,
  ) {
    return this.kitchenService.updateItemStatus(user.organizationId, user.sub, itemId, dto);
  }

  @Get('outlets/:outletId/stats')
  @RequirePermissions(PERMISSIONS.KITCHEN_READ)
  getPerformanceStats(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
  ) {
    return this.kitchenService.getPerformanceStats(outletId, user.organizationId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { PERMISSIONS } from '@cullinos/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KotService } from './kot.service';
import { UpdateKotStatusDto, UpdateKotItemStatusDto } from './dto/kot.dto';

interface AuthUser {
  sub: string;
  organizationId: string;
}

@Controller('kot')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KotController {
  constructor(private readonly kotService: KotService) {}

  @Post('orders/:orderId/generate')
  @RequirePermissions(PERMISSIONS.KITCHEN_UPDATE)
  generateFromOrder(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.kotService.generateKotsFromOrder(user.organizationId, orderId, user.sub);
  }

  @Get('outlets/:outletId')
  @RequirePermissions(PERMISSIONS.KITCHEN_READ)
  listKotsForOutlet(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kotService.listKotsForOutlet(
      outletId,
      user.organizationId,
      status,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.KITCHEN_READ)
  getKot(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kotService.getKot(id, user.organizationId);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.KITCHEN_UPDATE)
  updateKotStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateKotStatusDto,
  ) {
    return this.kotService.updateKotStatus(user.organizationId, user.sub, id, dto);
  }

  @Patch('items/:itemId/status')
  @RequirePermissions(PERMISSIONS.KITCHEN_UPDATE)
  updateKotItemStatus(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateKotItemStatusDto,
  ) {
    return this.kotService.updateKotItemStatus(user.organizationId, user.sub, itemId, dto);
  }
}

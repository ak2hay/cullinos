import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { PERMISSIONS } from '@cullinos/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PosService } from './pos.service';
import { QuickOrderDto } from './dto/pos.dto';

interface AuthUser {
  sub: string;
  organizationId: string;
}

@Controller('pos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('quick-order')
  @RequirePermissions(PERMISSIONS.POS_ACCESS)
  quickOrder(
    @CurrentUser() user: AuthUser,
    @Body() dto: QuickOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.posService.quickOrder(user.organizationId, user.sub, dto, idempotencyKey);
  }

  @Post('orders/:id/hold')
  @RequirePermissions(PERMISSIONS.POS_ACCESS)
  holdOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posService.holdOrder(user.organizationId, user.sub, id);
  }

  @Post('orders/:id/resume')
  @RequirePermissions(PERMISSIONS.POS_ACCESS)
  resumeOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posService.resumeOrder(user.organizationId, user.sub, id);
  }

  @Get('outlets/:outletId/day-summary')
  @RequirePermissions(PERMISSIONS.POS_ACCESS)
  getDaySummary(
    @CurrentUser() user: AuthUser,
    @Param('outletId') outletId: string,
  ) {
    return this.posService.getDaySummary(outletId, user.organizationId);
  }
}

import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncPullQueryDto, SyncPushDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('push')
  push(@CurrentUser('organizationId') orgId: string, @Body() dto: SyncPushDto) {
    return this.syncService.push(orgId, dto);
  }

  @Get('pull')
  pull(@CurrentUser('organizationId') orgId: string, @Query() query: SyncPullQueryDto) {
    return this.syncService.pull(orgId, query);
  }
}

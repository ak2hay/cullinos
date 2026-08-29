import { Controller, Get, Param, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { ListDevicesQueryDto, RegisterDeviceDto } from './dto/devices.dto';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Post('register')
  register(@CurrentUser('organizationId') orgId: string, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(orgId, dto);
  }

  @Get()
  list(@CurrentUser('organizationId') orgId: string, @Query() query: ListDevicesQueryDto) {
    return this.devicesService.list(orgId, query);
  }

  @Get(':id/sync-status')
  syncStatus(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.devicesService.syncStatus(orgId, id);
  }
}

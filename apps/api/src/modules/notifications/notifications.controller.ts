import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendNotificationDto, ListNotificationsQueryDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post()
  send(@CurrentUser('organizationId') orgId: string, @Body() dto: SendNotificationDto) {
    return this.notificationsService.send(orgId, dto);
  }

  @Get()
  list(@CurrentUser('organizationId') orgId: string, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.list(orgId, query);
  }

  @Get('templates')
  templates() {
    return this.notificationsService.getTemplates();
  }
}

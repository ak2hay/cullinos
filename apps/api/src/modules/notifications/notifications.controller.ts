import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { OrgId } from "../../common/decorators";
import { NotificationsService } from "./notifications.service";

class CreateNotificationDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn(["in_app", "sms", "email", "push"])
  channel?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@Controller("notifications")
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  list(@OrgId() orgId: string, @Query("channel") channel?: string) {
    return this.service.list(orgId, channel);
  }

  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateNotificationDto) {
    return this.service.create(orgId, dto);
  }
}

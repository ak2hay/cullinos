import { IsOptional, IsString, IsObject, IsIn } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  type!: string;

  @IsIn(['in_app', 'sms', 'email', 'push'])
  channel!: string;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

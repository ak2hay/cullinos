import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncEventDto {
  @IsString()
  id!: string;

  @IsString()
  deviceId!: string;

  @IsString()
  eventType!: string;

  payload!: Record<string, unknown>;

  @IsString()
  timestamp!: string;

  @IsString()
  checksum!: string;
}

export class SyncPushDto {
  @IsString()
  deviceId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  events!: SyncEventDto[];

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class SyncPullQueryDto {
  @IsString()
  deviceId!: string;

  @IsOptional()
  @IsString()
  since?: string;
}

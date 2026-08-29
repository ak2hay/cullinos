import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { KOTStatus } from '@cullinos/shared';

export class UpdateKotStatusDto {
  @IsString()
  status!: KOTStatus;
}

export class UpdateKotItemStatusDto {
  @IsString()
  status!: KOTStatus | 'PREPARING' | 'READY' | 'SERVED';
}

export class ListKotsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  limit?: number;
}

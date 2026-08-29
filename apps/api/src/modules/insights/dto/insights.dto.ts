import { IsOptional, IsString, IsUUID, IsObject } from 'class-validator';

export class CreateInsightDto {
  @IsString()
  type!: string;

  @IsString()
  summary!: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsObject()
  dataSnapshot?: Record<string, unknown>;
}

export class ListInsightsQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

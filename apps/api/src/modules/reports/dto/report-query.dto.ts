import { IsOptional, IsString, IsUUID, IsIn, IsDateString } from 'class-validator';

export class ReportQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv' = 'json';
}

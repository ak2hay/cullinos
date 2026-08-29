import { IsOptional, IsString, IsUUID, IsIn } from 'class-validator';

export class RegisterDeviceDto {
  @IsUUID()
  outletId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(['POS', 'KDS', 'WAITER', 'KIOSK'])
  type?: string;
}

export class ListDevicesQueryDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

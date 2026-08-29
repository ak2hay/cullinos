import { IsString } from 'class-validator';

export class UpdateKitchenItemStatusDto {
  @IsString()
  status!: 'PREPARING' | 'READY' | 'SERVED';
}

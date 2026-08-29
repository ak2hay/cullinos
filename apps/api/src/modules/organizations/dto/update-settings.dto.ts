import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrganizationSettingsDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  settings!: Record<string, unknown>;
}

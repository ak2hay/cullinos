import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateFloorDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateFloorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateSectionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTableDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  positionX?: number;

  @IsOptional()
  positionY?: number;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  positionX?: number;

  @IsOptional()
  positionY?: number;

  @IsOptional()
  isActive?: boolean;
}

export class UpdateTableStatusDto {
  @IsString()
  status!: string;
}

export class MergeTablesDto {
  @IsUUID()
  primaryTableId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  tableIds!: string[];
}

export class TransferTableDto {
  @IsUUID()
  fromTableId!: string;

  @IsUUID()
  toTableId!: string;
}

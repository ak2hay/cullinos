import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class SuperAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class SuspendOrgDto {
  @IsString()
  reason!: string;
}

export class ManageSubscriptionDto {
  @IsString()
  planId!: string;

  @IsString()
  status!: string;
}

export class ImpersonateOrgDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class UpdateOrgEnvironmentDto {
  @IsNumber()
  @IsIn([0, 1])
  environmentClass!: number;

  @IsOptional()
  @IsBoolean()
  sandboxSkipEmailOtp?: boolean;

  @IsOptional()
  @IsBoolean()
  sandboxSkipSmsOtp?: boolean;

  @IsOptional()
  @IsBoolean()
  sandboxRelaxPassword?: boolean;
}

export class LabsSqlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  sql!: string;
}

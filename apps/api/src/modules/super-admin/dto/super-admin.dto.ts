import { IsEmail, IsString, MinLength } from 'class-validator';

export class SuperAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
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

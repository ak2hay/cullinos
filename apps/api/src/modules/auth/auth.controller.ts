import { Body, Controller, ForbiddenException, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";
import type { Request } from "express";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, Public } from "../../common/decorators";
import { assertTurnstile } from "../../common/turnstile.util";
import { AuthService } from "./auth.service";
import { RefreshTokenDto } from "./dto/refresh.dto";

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

class VerifyOtpDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}

class ResendOtpDto {
  @IsString()
  challengeToken!: string;
}

class StaffPhoneOtpRequestDto {
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

class StaffPhoneOtpVerifyDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

class RegisterOwnerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

function clientIp(req: Request): string | undefined {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0]?.trim();
  return req.ip;
}

@Controller("auth")
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("register-owner")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async registerOwner(@Body() dto: RegisterOwnerDto, @Req() req: Request) {
    await assertTurnstile(dto.captchaToken, clientIp(req));
    return this.authService.registerOwner({
      companyName: dto.companyName,
      ownerName: dto.ownerName,
      ownerEmail: dto.ownerEmail,
      ownerPhone: dto.ownerPhone,
    });
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    await assertTurnstile(dto.captchaToken, clientIp(req));
    return this.authService.login(dto.email, dto.password, clientIp(req));
  }

  @Public()
  @Post("verify-otp")
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyLoginOtp(dto.challengeToken, dto.otp);
  }

  @Public()
  @Post("resend-otp")
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.challengeToken);
  }

  @Public()
  @Post("phone/otp/request")
  async requestPhoneOtp(@Body() dto: StaffPhoneOtpRequestDto, @Req() req: Request) {
    await assertTurnstile(dto.captchaToken, clientIp(req));
    return this.authService.requestStaffPhoneOtp(dto.phone);
  }

  @Public()
  @Post("phone/otp/verify")
  verifyPhoneOtp(@Body() dto: StaffPhoneOtpVerifyDto) {
    return this.authService.verifyStaffPhoneOtp(dto.challengeToken, dto.otp);
  }

  @Public()
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await assertTurnstile(dto.captchaToken, clientIp(req));
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post("change-password")
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    if (user.impersonation) {
      throw new ForbiddenException("Password changes are blocked during support impersonation");
    }
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}

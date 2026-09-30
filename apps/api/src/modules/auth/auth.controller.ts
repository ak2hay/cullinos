import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";
import type { Request, Response } from "express";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, Public } from "../../common/decorators";
import { assertTurnstile } from "../../common/turnstile.util";
import { clientIp } from "../../common/client-ip.util";
import { AuthService } from "./auth.service";
import { RefreshTokenDto } from "./dto/refresh.dto";
import { RefreshCookieInterceptor } from "./refresh-cookie.interceptor";
import { clearRefreshCookie, readRefreshCookie } from "./refresh-cookie.util";

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
  @MinLength(6)
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

class StaffPhoneOtpWidgetRetryDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  reqId!: string;
}

class StaffPhoneOtpWidgetConfirmDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  reqId!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone!: string;
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
  @MinLength(6)
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

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(20)
  ownerPhone!: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

@Controller("auth")
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@UseInterceptors(RefreshCookieInterceptor)
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

  /** MSG91 Widget path (no DLT/Flow) — preferred for Waiter when Widget is configured. */
  @Public()
  @Post("phone/otp/widget-send")
  async requestPhoneOtpWidget(
    @Body() dto: StaffPhoneOtpRequestDto,
    @Req() req: Request,
  ) {
    await assertTurnstile(dto.captchaToken, clientIp(req));
    return this.authService.requestStaffPhoneOtpWidget(dto.phone);
  }

  @Public()
  @Post("phone/otp/widget-retry")
  retryPhoneOtpWidget(@Body() dto: StaffPhoneOtpWidgetRetryDto) {
    return this.authService.retryStaffPhoneOtpWidget(dto.reqId);
  }

  @Public()
  @Post("phone/otp/widget-confirm")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  confirmPhoneOtpWidget(@Body() dto: StaffPhoneOtpWidgetConfirmDto) {
    return this.authService.confirmStaffPhoneOtpWidget({
      reqId: dto.reqId,
      otp: dto.otp,
      phone: dto.phone,
    });
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const token = dto.refreshToken || readRefreshCookie(req);
    if (!token) throw new UnauthorizedException("Invalid refresh token");
    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
    return this.authService.refreshAccessToken(token, userAgent);
  }

  @Public()
  @Post("logout")
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(dto.refreshToken || readRefreshCookie(req));
    clearRefreshCookie(req, res);
    return result;
  }

  /** Ends every session of the signed-in user on all devices. */
  @Post("logout-all")
  async logoutAll(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (user.impersonation) {
      throw new ForbiddenException("Not available during support impersonation");
    }
    const result = await this.authService.logoutAll(user.sub, user.organizationId, user.email);
    clearRefreshCookie(req, res);
    return result;
  }

  @Post("change-password")
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    if (user.impersonation) {
      throw new ForbiddenException("Password changes are blocked during support impersonation");
    }
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}

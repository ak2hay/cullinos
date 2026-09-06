import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import { IsEmail, IsString, Length, MinLength } from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, Public } from "../../common/decorators";
import { AuthService } from "./auth.service";

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(4)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
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

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
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
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
  }

  @Post("change-password")
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    if (user.impersonation) {
      throw new ForbiddenException("Password changes are blocked during support impersonation");
    }
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}

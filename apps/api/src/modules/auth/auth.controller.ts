import { Body, Controller, Post } from "@nestjs/common";
import { IsEmail, IsString, MinLength } from "class-validator";
import { Public } from "../../common/decorators";
import { AuthService } from "./auth.service";

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}

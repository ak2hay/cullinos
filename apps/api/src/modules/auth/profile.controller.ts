import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { memoryStorage } from "multer";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser } from "../../common/decorators";
import {
  MARKETING_UPLOAD_MAX_BYTES,
  marketingImageFileFilter,
} from "../marketing/marketing-upload.service";
import { ProfileService } from "./profile.service";

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;
}

function assertNotImpersonating(user: JwtPayload) {
  if (user.impersonation) {
    throw new ForbiddenException("Profile changes are blocked during support impersonation");
  }
}

/** Signed-in user's own profile (tenant staff and super admins). */
@Controller("auth/me")
export class ProfileController {
  constructor(private profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.profile.get(user.sub);
  }

  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    assertNotImpersonating(user);
    return this.profile.update(user.sub, dto);
  }

  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MARKETING_UPLOAD_MAX_BYTES },
      fileFilter: marketingImageFileFilter,
    }),
  )
  uploadAvatar(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    assertNotImpersonating(user);
    if (!file?.buffer) throw new BadRequestException("No file uploaded.");
    return this.profile.uploadAvatar(user.sub, file, user);
  }

  @Delete("avatar")
  removeAvatar(@CurrentUser() user: JwtPayload) {
    assertNotImpersonating(user);
    return this.profile.removeAvatar(user.sub);
  }
}

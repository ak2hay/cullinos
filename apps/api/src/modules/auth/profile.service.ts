import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  normalizePhoneE164,
  normalizeStaffPhone,
  staffPhoneLookupVariants,
} from "../../common/phone.util";
import {
  MarketingUploadService,
  uploadMaxBytesFor,
  type UploadActor,
} from "../marketing/marketing-upload.service";

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  avatarUrl: true,
  isSuperAdmin: true,
  platformRole: true,
  lastLoginAt: true,
  createdAt: true,
  organizationId: true,
  organization: { select: { name: true, slug: true } },
  userRoles: { select: { role: { select: { name: true } } } },
} as const;

export type ProfileUpdateInput = { name?: string; phone?: string | null };

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private uploads: MarketingUploadService,
  ) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) throw new NotFoundException("User not found");
    return this.toDto(user);
  }

  async update(userId: string, input: ProfileUpdateInput) {
    const data: { name?: string; phone?: string | null } = {};

    if (input.name !== undefined) {
      const name = input.name.trim().replace(/\s+/g, " ");
      if (name.length < 1 || name.length > 120) {
        throw new BadRequestException("Name must be 1–120 characters.");
      }
      data.name = name;
    }

    if (input.phone !== undefined) {
      const raw = input.phone?.trim() ?? "";
      if (!raw) {
        data.phone = null;
      } else {
        const digits = raw.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) {
          throw new BadRequestException("Enter a valid mobile number.");
        }
        // Staff phone OTP login resolves users by phone across tenants, so a number
        // may belong to only one active account.
        const taken = await this.prisma.user.findFirst({
          where: {
            id: { not: userId },
            status: "active",
            phone: { in: staffPhoneLookupVariants(normalizeStaffPhone(raw)) },
          },
          select: { id: true },
        });
        if (taken) {
          throw new BadRequestException("This mobile number is already used by another account.");
        }
        data.phone = normalizePhoneE164(raw);
      }
    }

    if (Object.keys(data).length === 0) return this.get(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: PROFILE_SELECT,
    });
    return this.toDto(user);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File, actor: UploadActor) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, isSuperAdmin: true, avatarUrl: true },
    });
    if (!current) throw new NotFoundException("User not found");

    const leafName = `${userId}-${Date.now().toString(36)}`;
    const saved = await this.uploads.saveUploadedFile(
      file,
      current.isSuperAdmin
        ? { scope: "platform", platformArea: "avatars", leafName, imageSlot: "avatar" }
        : { scope: "org", orgId: current.organizationId, leafName, imageSlot: "avatar" },
      uploadMaxBytesFor(actor),
    );

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: saved.url },
      select: PROFILE_SELECT,
    });
    await this.deleteAvatarFile(current);
    return this.toDto(user);
  }

  async removeAvatar(userId: string) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, isSuperAdmin: true, avatarUrl: true },
    });
    if (!current) throw new NotFoundException("User not found");
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: PROFILE_SELECT,
    });
    await this.deleteAvatarFile(current);
    return this.toDto(user);
  }

  private async deleteAvatarFile(user: {
    organizationId: string;
    isSuperAdmin: boolean;
    avatarUrl: string | null;
  }) {
    if (!user.avatarUrl) return;
    await this.uploads.deleteManagedUrl(
      user.avatarUrl,
      user.isSuperAdmin ? "platform" : { orgId: user.organizationId },
    );
  }

  private toDto(user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
    platformRole: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    organizationId: string;
    organization: { name: string; slug: string };
    userRoles: { role: { name: string } }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isSuperAdmin: user.isSuperAdmin,
      platformRole: user.platformRole,
      roles: user.userRoles.map((ur) => ur.role.name),
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationSlug: user.organization.slug,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class GuestAppPrivacyService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async exportGuestUser(id: string, actorUserId?: string) {
    const user = await this.prisma.guestUser.findUnique({
      where: { id },
      include: {
        devices: true,
        addresses: true,
        memberships: {
          include: {
            organization: { select: { id: true, name: true, slug: true } },
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                loyaltyPoints: true,
                marketingEmailOptIn: true,
                marketingSmsOptIn: true,
              },
            },
          },
        },
        reviews: {
          include: {
            outlet: { select: { id: true, name: true, city: true } },
          },
        },
        notifications: { orderBy: { createdAt: "desc" }, take: 500 },
        notificationPreference: true,
        favoriteOutlets: true,
        favoriteItems: true,
      },
    });
    if (!user) throw new NotFoundException("Guest user not found");

    const orgId = user.memberships[0]?.organizationId;
    if (orgId) {
      await this.audit.log({
        organizationId: orgId,
        userId: actorUserId,
        action: "guest_user_exported",
        entityType: "GuestUser",
        entityId: id,
        metadata: {
          membershipCount: user.memberships.length,
          deviceCount: user.devices.length,
        },
      });
    }

    return {
      exportedAt: new Date().toISOString(),
      guestUser: user,
    };
  }

  async eraseGuestUser(id: string, actorUserId?: string) {
    const user = await this.prisma.guestUser.findUnique({
      where: { id },
      include: {
        memberships: { select: { organizationId: true }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException("Guest user not found");
    if (user.anonymizedAt) {
      throw new BadRequestException("Guest user already anonymized");
    }

    await this.prisma.$transaction([
      this.prisma.guestDevice.deleteMany({ where: { guestUserId: id } }),
      this.prisma.guestAddress.deleteMany({ where: { guestUserId: id } }),
      this.prisma.guestNotificationPreference.upsert({
        where: { guestUserId: id },
        create: {
          guestUserId: id,
          transactionalEnabled: true,
          marketingEnabled: false,
        },
        update: { marketingEnabled: false },
      }),
      this.prisma.guestUser.update({
        where: { id },
        data: {
          phone: null,
          email: null,
          name: "Anonymized Guest",
          firebaseUid: null,
          pinHash: null,
          pinUpdatedAt: null,
          marketingEmailOptIn: false,
          marketingSmsOptIn: false,
          anonymizedAt: new Date(),
        },
      }),
    ]);

    const orgId = user.memberships[0]?.organizationId;
    if (orgId) {
      await this.audit.log({
        organizationId: orgId,
        userId: actorUserId,
        action: "guest_user_erased",
        entityType: "GuestUser",
        entityId: id,
        metadata: { method: "anonymize" },
      });
    }

    return {
      id,
      anonymizedAt: new Date().toISOString(),
      message: "Guest user personal data anonymized; FCM devices removed",
    };
  }

  async suspendGuestUser(
    id: string,
    reason: string | undefined,
    actorUserId?: string,
  ) {
    const user = await this.prisma.guestUser.findUnique({
      where: { id },
      include: {
        memberships: { select: { organizationId: true }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException("Guest user not found");
    if (user.anonymizedAt) {
      throw new BadRequestException("Guest user already anonymized");
    }
    if (user.suspendedAt) {
      throw new BadRequestException("Guest user already suspended");
    }

    const suspendReason = reason?.trim() || null;
    const updated = await this.prisma.guestUser.update({
      where: { id },
      data: {
        suspendedAt: new Date(),
        suspendReason,
      },
    });

    // Drop push devices so suspended accounts stop receiving FCM.
    await this.prisma.guestDevice.deleteMany({ where: { guestUserId: id } });

    const orgId = user.memberships[0]?.organizationId;
    if (orgId) {
      await this.audit.log({
        organizationId: orgId,
        userId: actorUserId,
        action: "guest_user_suspended",
        entityType: "GuestUser",
        entityId: id,
        metadata: { reason: suspendReason },
      });
    }

    return {
      id: updated.id,
      suspendedAt: updated.suspendedAt?.toISOString() ?? null,
      suspendReason: updated.suspendReason,
      message: "Guest user suspended",
    };
  }

  async unsuspendGuestUser(id: string, actorUserId?: string) {
    const user = await this.prisma.guestUser.findUnique({
      where: { id },
      include: {
        memberships: { select: { organizationId: true }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException("Guest user not found");
    if (!user.suspendedAt) {
      throw new BadRequestException("Guest user is not suspended");
    }

    const updated = await this.prisma.guestUser.update({
      where: { id },
      data: {
        suspendedAt: null,
        suspendReason: null,
      },
    });

    const orgId = user.memberships[0]?.organizationId;
    if (orgId) {
      await this.audit.log({
        organizationId: orgId,
        userId: actorUserId,
        action: "guest_user_unsuspended",
        entityType: "GuestUser",
        entityId: id,
        metadata: {},
      });
    }

    return {
      id: updated.id,
      suspendedAt: null,
      message: "Guest user unsuspended",
    };
  }
}

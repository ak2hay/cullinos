import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { FirebaseAdminService } from "./firebase-admin.service";

type PushPayload = {
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, string>;
};

/**
 * Guest FCM sender via Firebase Admin SDK (HTTP v1).
 * Requires FIREBASE_SERVICE_ACCOUNT_* (same credentials as guest Firebase auth).
 */
@Injectable()
export class GuestPushService {
  private readonly logger = new Logger(GuestPushService.name);

  constructor(
    private prisma: PrismaService,
    private firebase: FirebaseAdminService,
  ) {}

  /** True when Firebase Admin service-account credentials are loaded. */
  isConfigured(): boolean {
    return this.firebase.isConfigured();
  }

  async notifyGuestUser(guestUserId: string, payload: PushPayload) {
    try {
      await this.prisma.guestNotification.create({
        data: {
          guestUserId,
          title: payload.title,
          body: payload.body,
          type: payload.data?.type || "push",
          data: {
            ...(payload.data ?? {}),
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        `Inbox write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const prefs = await this.prisma.guestNotificationPreference.findUnique({
      where: { guestUserId },
    });
    const isMarketing = (payload.data?.type || "").startsWith("marketing");
    if (prefs) {
      if (isMarketing && !prefs.marketingEnabled) return { sent: 0 };
      if (!isMarketing && !prefs.transactionalEnabled) return { sent: 0 };
    }

    const devices = await this.prisma.guestDevice.findMany({
      where: { guestUserId },
      take: 20,
    });
    if (devices.length === 0) return { sent: 0 };

    let sent = 0;
    for (const device of devices) {
      const ok = await this.sendToToken(device.fcmToken, payload, isMarketing);
      if (ok) sent += 1;
    }
    return { sent };
  }

  async notifyCustomerOrder(
    customerId: string | null | undefined,
    payload: PushPayload,
  ) {
    if (!customerId) return { sent: 0 };
    const membership = await this.prisma.guestOrgMembership.findUnique({
      where: { customerId },
    });
    if (!membership) return { sent: 0 };
    return this.notifyGuestUser(membership.guestUserId, payload);
  }

  private async sendToToken(
    token: string,
    payload: PushPayload,
    isMarketing: boolean,
  ): Promise<boolean> {
    if (!this.firebase.isConfigured()) {
      this.logger.debug(
        `FCM skip (Firebase Admin not configured): ${payload.title} → ${token.slice(0, 12)}…`,
      );
      return false;
    }

    const imageUrl = payload.imageUrl?.trim() || payload.data?.imageUrl?.trim();
    const data: Record<string, string> = { ...(payload.data ?? {}) };
    if (imageUrl) data.imageUrl = imageUrl;

    const result = await this.firebase.sendFcm({
      token,
      title: payload.title,
      body: payload.body,
      imageUrl,
      data,
      androidChannelId: isMarketing ? "marketing" : "orders",
    });

    if (result.ok) return true;

    if (result.invalidToken) {
      try {
        await this.prisma.guestDevice.deleteMany({ where: { fcmToken: token } });
        this.logger.warn(
          `FCM pruned invalid token ${token.slice(0, 12)}… (${result.code ?? "invalid"})`,
        );
      } catch (err) {
        this.logger.warn(
          `FCM prune failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      this.logger.warn(
        `FCM error${result.code ? ` ${result.code}` : ""}: ${result.message.slice(0, 200)}`,
      );
    }
    return false;
  }
}

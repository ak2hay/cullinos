import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";

type PushPayload = {
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, string>;
};

/**
 * FCM legacy HTTP sender. Uses platform setting `FCM_SERVER_KEY`.
 * Supports optional notification.image for Android tray BigPicture.
 */
@Injectable()
export class GuestPushService {
  private readonly logger = new Logger(GuestPushService.name);

  constructor(
    private prisma: PrismaService,
    private platformConfig: PlatformConfigService,
  ) {}

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
      const ok = await this.sendToToken(device.fcmToken, payload);
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

  private async sendToToken(token: string, payload: PushPayload): Promise<boolean> {
    const serverKey =
      this.platformConfig.get("FCM_SERVER_KEY") || process.env.FCM_SERVER_KEY;

    if (!serverKey) {
      this.logger.debug(
        `FCM skip (no key): ${payload.title} → ${token.slice(0, 12)}…`,
      );
      return false;
    }

    const imageUrl = payload.imageUrl?.trim() || payload.data?.imageUrl?.trim();
    const data: Record<string, string> = { ...(payload.data ?? {}) };
    if (imageUrl) data.imageUrl = imageUrl;

    try {
      const notification: Record<string, string> = {
        title: payload.title,
        body: payload.body,
      };
      if (imageUrl) notification.image = imageUrl;

      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          notification,
          data,
          priority: "high",
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.logger.warn(`FCM failed ${res.status}: ${text.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`FCM error: ${(err as Error).message}`);
      return false;
    }
  }
}

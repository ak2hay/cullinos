import { describe, expect, it, vi } from "vitest";
import { GuestPushService } from "./guest-push.service";

describe("GuestPushService FCM HTTP v1", () => {
  it("skips send when marketing prefs are off", async () => {
    const prisma = {
      guestNotification: { create: vi.fn().mockResolvedValue({}) },
      guestNotificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          marketingEnabled: false,
          transactionalEnabled: true,
        }),
      },
      guestDevice: { findMany: vi.fn(), deleteMany: vi.fn() },
    };
    const firebase = {
      isConfigured: vi.fn().mockReturnValue(true),
      sendFcm: vi.fn(),
    };

    const push = new GuestPushService(prisma as never, firebase as never);
    const result = await push.notifyGuestUser("guest_1", {
      title: "Offer",
      body: "Hello",
      data: { type: "marketing_campaign" },
    });

    expect(result).toEqual({ sent: 0 });
    expect(firebase.sendFcm).not.toHaveBeenCalled();
    expect(prisma.guestDevice.findMany).not.toHaveBeenCalled();
  });

  it("sends via Admin SDK and counts successful devices", async () => {
    const prisma = {
      guestNotification: { create: vi.fn().mockResolvedValue({}) },
      guestNotificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          marketingEnabled: true,
          transactionalEnabled: true,
        }),
      },
      guestDevice: {
        findMany: vi.fn().mockResolvedValue([
          { fcmToken: "token_a" },
          { fcmToken: "token_b" },
        ]),
        deleteMany: vi.fn(),
      },
    };
    const firebase = {
      isConfigured: vi.fn().mockReturnValue(true),
      sendFcm: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, messageId: "m1" })
        .mockResolvedValueOnce({
          ok: false,
          code: "messaging/registration-token-not-registered",
          message: "gone",
          invalidToken: true,
        }),
    };

    const push = new GuestPushService(prisma as never, firebase as never);
    const result = await push.notifyGuestUser("guest_1", {
      title: "Offer",
      body: "Hello",
      imageUrl: "https://cdn.example/hero.jpg",
      data: { type: "marketing_campaign", campaignId: "c1" },
    });

    expect(result).toEqual({ sent: 1 });
    expect(firebase.sendFcm).toHaveBeenCalledTimes(2);
    expect(firebase.sendFcm).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token_a",
        title: "Offer",
        androidChannelId: "marketing",
        imageUrl: "https://cdn.example/hero.jpg",
      }),
    );
    expect(prisma.guestDevice.deleteMany).toHaveBeenCalledWith({
      where: { fcmToken: "token_b" },
    });
  });

  it("returns sent 0 when Firebase Admin is not configured", async () => {
    const prisma = {
      guestNotification: { create: vi.fn().mockResolvedValue({}) },
      guestNotificationPreference: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      guestDevice: {
        findMany: vi.fn().mockResolvedValue([{ fcmToken: "token_a" }]),
        deleteMany: vi.fn(),
      },
    };
    const firebase = {
      isConfigured: vi.fn().mockReturnValue(false),
      sendFcm: vi.fn(),
    };

    const push = new GuestPushService(prisma as never, firebase as never);
    const result = await push.notifyGuestUser("guest_1", {
      title: "Ready",
      body: "Order ready",
      data: { type: "order_status" },
    });

    expect(result).toEqual({ sent: 0 });
    expect(firebase.sendFcm).not.toHaveBeenCalled();
  });
});

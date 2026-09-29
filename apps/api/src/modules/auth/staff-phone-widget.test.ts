import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedException, ServiceUnavailableException } from "@nestjs/common";
import { AuthService } from "./auth.service";

function makeAuthService(deps: {
  findFirst?: ReturnType<typeof vi.fn>;
  findMany?: ReturnType<typeof vi.fn>;
  userUpdate?: ReturnType<typeof vi.fn>;
  widgetSendOtp?: ReturnType<typeof vi.fn>;
  widgetVerifyOtp?: ReturnType<typeof vi.fn>;
  verifyWidgetAccessToken?: ReturnType<typeof vi.fn>;
  isWidgetConfigured?: ReturnType<typeof vi.fn>;
  issueLoginResponse?: ReturnType<typeof vi.fn>;
  binding?: { id: string; phone: string; organizationId: string } | null;
}) {
  const prisma = {
    user: {
      findFirst: deps.findFirst ?? vi.fn().mockResolvedValue(null),
      findMany: deps.findMany ?? vi.fn().mockResolvedValue([]),
      update: deps.userUpdate ?? vi.fn().mockResolvedValue({}),
    },
    phoneOtp: {
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(deps.binding ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const msg91 = {
    normalizePhone: (p: string) => {
      const d = p.replace(/\D/g, "");
      return d.length === 10 ? `91${d}` : d;
    },
    otpTtlSeconds: () => 300,
    isWidgetConfigured: deps.isWidgetConfigured ?? vi.fn().mockReturnValue(true),
    widgetSendOtp: deps.widgetSendOtp ?? vi.fn(),
    widgetRetryOtp: vi.fn(),
    widgetVerifyOtp: deps.widgetVerifyOtp ?? vi.fn(),
    verifyWidgetAccessToken: deps.verifyWidgetAccessToken ?? vi.fn(),
    sendOtp: vi.fn(),
  };
  const jwt = { sign: vi.fn(), verify: vi.fn() };
  const mail = {};
  const config = { get: vi.fn() };
  const audit = { log: vi.fn() };
  const provisioning = {};
  const portalStatus = {};

  const svc = new AuthService(
    prisma as never,
    jwt as never,
    mail as never,
    config as never,
    audit as never,
    msg91 as never,
    provisioning as never,
    portalStatus as never,
  );

  if (deps.issueLoginResponse) {
    vi.spyOn(svc as never, "issueLoginResponse" as never).mockImplementation(
      deps.issueLoginResponse as never,
    );
  } else {
    vi.spyOn(svc as never, "issueLoginResponse" as never).mockResolvedValue({
      accessToken: "tok",
      refreshToken: "ref",
      user: { id: "u1" },
    } as never);
  }

  return { svc, prisma, msg91 };
}

const activeStaff = {
  id: "u1",
  phone: "919876543210",
  organizationId: "org1",
  status: "active",
  isSuperAdmin: false,
  organization: { status: "active", environmentClass: 1 },
};

describe("staff phone OTP via MSG91 Widget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("widget-send rejects unknown phone without calling MSG91", async () => {
    const widgetSendOtp = vi.fn();
    const { svc } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      widgetSendOtp,
      isWidgetConfigured: vi.fn().mockReturnValue(true),
    });

    await expect(svc.requestStaffPhoneOtpWidget("9876543210")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(widgetSendOtp).not.toHaveBeenCalled();
  });

  it("widget-send calls MSG91 when staff exists", async () => {
    const widgetSendOtp = vi.fn().mockResolvedValue({ ok: true, reqId: "req-abc" });
    const { svc, prisma } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(activeStaff),
      widgetSendOtp,
    });

    const res = await svc.requestStaffPhoneOtpWidget("9876543210");
    expect(widgetSendOtp).toHaveBeenCalledWith("919876543210");
    expect(prisma.phoneOtp.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: "919876543210", organizationId: "org1" }),
      }),
    );
    expect(res).toMatchObject({
      reqId: "req-abc",
      sent: true,
      provider: "msg91",
      expiresIn: 300,
    });
  });

  it("widget-confirm rejects a reqId that was not issued for this phone", async () => {
    const widgetVerifyOtp = vi.fn();
    const { svc } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(activeStaff),
      binding: { id: "b1", phone: "919111111111", organizationId: "org1" },
      widgetVerifyOtp,
    });

    await expect(
      svc.confirmStaffPhoneOtpWidget({ reqId: "req-1", otp: "123456", phone: "9876543210" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(widgetVerifyOtp).not.toHaveBeenCalled();
  });

  it("widget-confirm rejects when no binding exists", async () => {
    const widgetVerifyOtp = vi.fn();
    const { svc } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(activeStaff),
      binding: null,
      widgetVerifyOtp,
    });

    await expect(
      svc.confirmStaffPhoneOtpWidget({ reqId: "req-1", otp: "123456", phone: "9876543210" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(widgetVerifyOtp).not.toHaveBeenCalled();
  });

  it("widget-confirm succeeds and consumes the binding when phone matches", async () => {
    const { svc, prisma } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(activeStaff),
      binding: { id: "b1", phone: "919876543210", organizationId: "org1" },
      widgetVerifyOtp: vi.fn().mockResolvedValue({ ok: true, accessToken: "a".repeat(40) }),
      verifyWidgetAccessToken: vi.fn().mockResolvedValue({ ok: true }),
    });

    await expect(
      svc.confirmStaffPhoneOtpWidget({ reqId: "req-1", otp: "123456", phone: "9876543210" }),
    ).resolves.toMatchObject({ accessToken: "tok" });
    expect(prisma.phoneOtp.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1", consumedAt: null } }),
    );
  });

  it("widget-confirm rejects when MSG91 phone does not match staff phone", async () => {
    const { svc, msg91 } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(activeStaff),
      binding: { id: "b1", phone: "919876543210", organizationId: "org1" },
      widgetVerifyOtp: vi.fn().mockResolvedValue({
        ok: true,
        accessToken: "a".repeat(40),
      }),
      verifyWidgetAccessToken: vi.fn().mockResolvedValue({
        ok: true,
        phone: "919111111111",
      }),
    });

    await expect(
      svc.confirmStaffPhoneOtpWidget({
        reqId: "req-1",
        otp: "123456",
        phone: "9876543210",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(msg91.widgetVerifyOtp).toHaveBeenCalled();
  });

  it("widget-confirm rejects when staff missing", async () => {
    const widgetVerifyOtp = vi.fn();
    const { svc } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      widgetVerifyOtp,
    });

    await expect(
      svc.confirmStaffPhoneOtpWidget({
        reqId: "req-1",
        otp: "123456",
        phone: "9876543210",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(widgetVerifyOtp).not.toHaveBeenCalled();
  });

  it("widget-send fails when Widget is not configured", async () => {
    const { svc } = makeAuthService({
      findFirst: vi.fn().mockResolvedValue(activeStaff),
      isWidgetConfigured: vi.fn().mockReturnValue(false),
    });

    await expect(svc.requestStaffPhoneOtpWidget("9876543210")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

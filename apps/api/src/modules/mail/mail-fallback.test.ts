import { beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: resendSend } })),
}));

const smtpSend = vi.fn();
vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({ sendMail: smtpSend, verify: vi.fn() })),
}));

import { MailService } from "./mail.service";

function service(env: Record<string, string>) {
  const config = { get: (k: string) => env[k], onChange: () => () => undefined };
  return new MailService(config as never);
}

const mail = { to: "new@rkyves.com", subject: "Hi", text: "Hello" };

describe("MailService transport fallback", () => {
  beforeEach(() => {
    resendSend.mockReset().mockResolvedValue({ data: { id: "r1" }, error: null });
    smtpSend.mockReset();
  });

  it("uses Resend when SMTP is not configured", async () => {
    const ok = await service({ RESEND_API_KEY: "re_x", MAIL_FROM_EMAIL: "noreply@cullinos.com" }).sendMail(mail);
    expect(ok).toBe(true);
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["new@rkyves.com"], from: "Cullinos <noreply@cullinos.com>" }),
    );
  });

  it("falls back to Resend when SMTP fails", async () => {
    smtpSend.mockRejectedValue(new Error("535 auth failed"));
    const ok = await service({ SMTP_HOST: "smtp", SMTP_USER: "u", SMTP_PASS: "p", RESEND_API_KEY: "re_x" }).sendMail(mail);
    expect(smtpSend).toHaveBeenCalledOnce();
    expect(ok).toBe(true);
    expect(resendSend).toHaveBeenCalledOnce();
  });

  it("does not call Resend when SMTP succeeds", async () => {
    smtpSend.mockResolvedValue({});
    const ok = await service({ SMTP_HOST: "smtp", SMTP_USER: "u", SMTP_PASS: "p", RESEND_API_KEY: "re_x" }).sendMail(mail);
    expect(ok).toBe(true);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("reports failure when no transport works", async () => {
    expect(await service({}).sendMail(mail)).toBe(false);
  });
});

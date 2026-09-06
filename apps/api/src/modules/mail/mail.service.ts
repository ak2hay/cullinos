import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { Resend } from "resend";
import { PlatformConfigService } from "../platform-config/platform-config.service";

export type OwnerCredentialsEmailInput = {
  to: string;
  ownerName: string;
  restaurantName: string;
  temporaryPassword: string;
  adminUrl: string;
};

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

const SMTP_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "MAIL_FROM_EMAIL",
  "RESEND_API_KEY",
];

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private smtpTransport: Transporter | null = null;
  private unsub?: () => void;

  constructor(private readonly config: PlatformConfigService) {}

  onModuleInit() {
    this.unsub = this.config.onChange((keys) => {
      if (keys.some((k) => SMTP_KEYS.includes(k))) {
        this.resetTransport();
      }
    });
  }

  onModuleDestroy() {
    this.unsub?.();
  }

  resetTransport() {
    this.smtpTransport = null;
  }

  private getSmtpFrom(): { email: string; name: string } {
    return {
      email:
        this.config.get("SMTP_FROM_EMAIL") ??
        this.config.get("MAIL_FROM_EMAIL") ??
        "noreply@cullinos.com",
      name: this.config.get("SMTP_FROM_NAME") ?? "Cullinos",
    };
  }

  private getSmtpTransport(): Transporter | null {
    const host = this.config.get("SMTP_HOST");
    const user = this.config.get("SMTP_USER");
    const pass = this.config.get("SMTP_PASS");
    if (!host || !user || !pass) {
      return null;
    }
    if (!this.smtpTransport) {
      const port = Number(this.config.get("SMTP_PORT") ?? 587);
      this.smtpTransport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
    return this.smtpTransport;
  }

  /** Verify SMTP connectivity with current effective config. */
  async testSmtp(): Promise<{ ok: boolean; message: string }> {
    this.resetTransport();
    const transport = this.getSmtpTransport();
    if (!transport) {
      return { ok: false, message: "SMTP is not fully configured (host, user, pass required)" };
    }
    try {
      await transport.verify();
      return { ok: true, message: "SMTP connection verified" };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendMail(input: SendMailInput): Promise<boolean> {
    const transport = this.getSmtpTransport();
    const from = this.getSmtpFrom();
    const recipients = Array.isArray(input.to) ? input.to : [input.to];

    if (!transport) {
      this.logger.warn(
        `SMTP not configured. Email logged for ${recipients.join(", ")}`,
      );
      this.logger.log(`[mail] ${input.subject}\n${input.text}`);
      return false;
    }

    try {
      await transport.sendMail({
        from: `${from.name} <${from.email}>`,
        to: recipients.join(", "),
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `SMTP send failed to ${recipients.join(", ")}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  async sendOtpEmail(to: string, code: string, purpose: "login_2fa" | "password_reset"): Promise<boolean> {
    const isReset = purpose === "password_reset";
    const subject = isReset
      ? "Your Cullinos password reset code"
      : "Your Cullinos login verification code";
    const action = isReset ? "reset your password" : "complete your login";
    const text = [
      `Your verification code is: ${code}`,
      "",
      `Enter this code to ${action}.`,
      "It expires in 10 minutes. If you did not request this, you can ignore this email.",
      "",
      "— Cullinos",
    ].join("\n");
    const html = `
      <p>Your verification code is:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>Enter this code to ${action}. It expires in 10 minutes.</p>
      <p style="color:#666">If you did not request this, you can ignore this email.</p>
      <p>— Cullinos</p>
    `;
    return this.sendMail({ to, subject, text, html });
  }

  async sendPromoEmail(to: string, subject: string, body: string): Promise<boolean> {
    const text = body;
    const html = body
      .split("\n")
      .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<br/>"))
      .join("\n");
    return this.sendMail({ to, subject, text, html });
  }

  async sendOwnerCredentials(input: OwnerCredentialsEmailInput): Promise<boolean> {
    const apiKey = this.config.get("RESEND_API_KEY");
    const fromEmail = this.config.get("MAIL_FROM_EMAIL") ?? "onboarding@resend.dev";
    const subject = `Your Cullinos admin login for ${input.restaurantName}`;
    const text = [
      `Hi ${input.ownerName},`,
      "",
      `Your restaurant "${input.restaurantName}" has been onboarded on Cullinos.`,
      "",
      `Admin login: ${input.adminUrl}`,
      `Email: ${input.to}`,
      `Temporary password: ${input.temporaryPassword}`,
      "",
      "You must change this password on first login.",
      "",
      "— Cullinos / Rkyves",
    ].join("\n");

    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set. Owner credentials email logged for ${input.to}`,
      );
      this.logger.log(`[mail] ${subject}\n${text}`);
      return false;
    }

    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: `Cullinos <${fromEmail}>`,
        to: [input.to],
        subject,
        text,
      });
      if (result.error) {
        this.logger.error(`Resend error for ${input.to}: ${JSON.stringify(result.error)}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to email owner credentials to ${input.to}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

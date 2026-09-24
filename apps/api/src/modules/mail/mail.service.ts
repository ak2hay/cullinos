import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { Resend } from "resend";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { redactEmail, redactRecipientList } from "../../common/pii-redact.util";
import {
  buildOtpEmail,
  buildOwnerCredentialsEmail,
  buildPromoEmail,
  buildReservationConfirmationEmail,
  buildReservationInviteEmail,
  buildSmtpTestEmail,
  type OtpPurpose,
} from "./templates";

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
  headers?: Record<string, string>;
  /** When true, use marketing From address (news.* subdomain when configured). */
  marketing?: boolean;
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

  /** Marketing / broadcast From — prefer news.* subdomain when configured. */
  private getMarketingFrom(): { email: string; name: string } {
    const transactional = this.getSmtpFrom();
    return {
      email:
        this.config.get("SMTP_MARKETING_FROM_EMAIL")?.trim() ||
        transactional.email,
      name:
        this.config.get("SMTP_MARKETING_FROM_NAME")?.trim() ||
        transactional.name,
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

  /** Verify SMTP connectivity; optionally send a test email to `to`. */
  async testSmtp(to?: string): Promise<{ ok: boolean; message: string }> {
    this.resetTransport();
    const transport = this.getSmtpTransport();
    if (!transport) {
      return { ok: false, message: "SMTP is not fully configured (host, user, pass required)" };
    }
    try {
      await transport.verify();
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }

    const recipient = to?.trim();
    if (!recipient) {
      return { ok: true, message: "SMTP connection verified" };
    }

    const tpl = buildSmtpTestEmail();
    const sent = await this.sendMail({
      to: recipient,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });

    if (!sent) {
      return {
        ok: false,
        message: `SMTP connected, but failed to send test email to ${redactEmail(recipient)} (see server logs)`,
      };
    }
    return {
      ok: true,
      message: `SMTP connection verified and test email sent to ${redactEmail(recipient)}`,
    };
  }

  async sendMail(input: SendMailInput): Promise<boolean> {
    const transport = this.getSmtpTransport();
    const from = input.marketing ? this.getMarketingFrom() : this.getSmtpFrom();
    const recipients = Array.isArray(input.to) ? input.to : [input.to];

    if (!transport) {
      this.logger.warn(
        `SMTP not configured. Skipping email to ${redactRecipientList(recipients)} (subject: ${input.subject})`,
      );
      return false;
    }

    try {
      await transport.sendMail({
        from: `${from.name} <${from.email}>`,
        to: recipients.join(", "),
        subject: input.subject,
        text: input.text,
        html: input.html,
        headers: input.headers,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `SMTP send failed to ${redactRecipientList(recipients)}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  async sendOtpEmail(
    to: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    const tpl = buildOtpEmail(code, purpose);
    return this.sendMail({
      to,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }

  async sendPromoEmail(
    to: string,
    subject: string,
    body: string,
    opts?: { unsubscribeUrl?: string },
  ): Promise<boolean> {
    const tpl = buildPromoEmail(subject, body, opts);
    const unsub = opts?.unsubscribeUrl;
    return this.sendMail({
      to,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
      marketing: true,
      headers: unsub
        ? {
            "List-Unsubscribe": `<${unsub}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    });
  }

  async sendOwnerCredentials(input: OwnerCredentialsEmailInput): Promise<boolean> {
    const apiKey = this.config.get("RESEND_API_KEY");
    const fromEmail = this.config.get("MAIL_FROM_EMAIL") ?? "onboarding@resend.dev";
    const tpl = buildOwnerCredentialsEmail({
      ownerName: input.ownerName,
      restaurantName: input.restaurantName,
      email: input.to,
      temporaryPassword: input.temporaryPassword,
      adminUrl: input.adminUrl,
    });

    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set. Skipping owner credentials email for ${redactEmail(input.to)}`,
      );
      return false;
    }

    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: `Cullinos <${fromEmail}>`,
        to: [input.to],
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      if (result.error) {
        this.logger.error(
          `Resend error for ${redactEmail(input.to)}: ${JSON.stringify(result.error)}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to email owner credentials to ${redactEmail(input.to)}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  async sendReservationInvite(input: {
    to: string;
    customerName: string;
    outletName: string;
    bookUrl: string;
  }): Promise<boolean> {
    const tpl = buildReservationInviteEmail(input);
    return this.sendMail({
      to: input.to,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }

  async sendReservationConfirmation(input: {
    to: string;
    customerName: string;
    outletName: string;
    reservedAt: Date;
    partySize: number;
  }): Promise<boolean> {
    const when = input.reservedAt.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
    const tpl = buildReservationConfirmationEmail({
      customerName: input.customerName,
      outletName: input.outletName,
      when,
      partySize: input.partySize,
    });
    return this.sendMail({
      to: input.to,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }
}

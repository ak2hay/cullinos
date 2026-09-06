import { Injectable, Logger } from "@nestjs/common";
import { PlatformConfigService } from "../platform-config/platform-config.service";

export type SendOtpResult = {
  sent: boolean;
  provider: "msg91" | "log";
};

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);

  constructor(private readonly config: PlatformConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get("MSG91_AUTH_KEY") && this.config.get("MSG91_TEMPLATE_ID"),
    );
  }

  otpTtlSeconds(): number {
    return Number(this.config.get("MSG91_OTP_TTL_SECONDS") ?? 300);
  }

  status() {
    return {
      configured: this.isConfigured(),
      senderId: this.config.get("MSG91_SENDER_ID") ?? null,
      templateId: this.config.get("MSG91_TEMPLATE_ID") ? "set" : null,
      otpTtlSeconds: this.otpTtlSeconds(),
    };
  }

  /** Normalize to E.164-ish Indian mobile without +. */
  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return digits;
    return digits;
  }

  async sendOtp(phone: string, otp: string): Promise<SendOtpResult> {
    const mobile = this.normalizePhone(phone);
    const authKey = this.config.get("MSG91_AUTH_KEY");
    const templateId = this.config.get("MSG91_TEMPLATE_ID");
    const senderId = this.config.get("MSG91_SENDER_ID") ?? "CULLIN";

    if (!authKey || !templateId) {
      this.logger.warn(`MSG91 not configured. OTP for ${mobile}: ${otp}`);
      return { sent: false, provider: "log" };
    }

    try {
      const res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({
          template_id: templateId,
          short_url: "0",
          recipients: [
            {
              mobiles: mobile,
              OTP: otp,
              var: otp,
            },
          ],
          sender: senderId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`MSG91 send failed (${res.status}): ${text}`);
        this.logger.warn(`Fallback OTP for ${mobile}: ${otp}`);
        return { sent: false, provider: "log" };
      }

      return { sent: true, provider: "msg91" };
    } catch (err) {
      this.logger.error(
        `MSG91 error: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.logger.warn(`Fallback OTP for ${mobile}: ${otp}`);
      return { sent: false, provider: "log" };
    }
  }

  async testConfig(phone?: string): Promise<{
    ok: boolean;
    message: string;
    status: ReturnType<Msg91Service["status"]>;
  }> {
    const status = this.status();
    if (!status.configured) {
      return {
        ok: false,
        message: "MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required",
        status,
      };
    }
    if (!phone?.trim()) {
      return {
        ok: true,
        message: "MSG91 is configured (no test SMS sent)",
        status,
      };
    }
    const otp = "000000";
    const result = await this.sendOtp(phone.trim(), otp);
    return {
      ok: result.sent,
      message: result.sent
        ? `Test OTP sent via MSG91 to ${this.normalizePhone(phone)}`
        : "MSG91 send failed (see server logs)",
      status,
    };
  }
}

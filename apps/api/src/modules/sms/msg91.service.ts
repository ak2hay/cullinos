import { Injectable, Logger } from "@nestjs/common";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import {
  extractPhoneFromJwt,
  extractPhoneFromVerifyPayload,
} from "./msg91-widget.util";
import { redactPhone } from "../../common/pii-redact.util";

export type SendOtpResult = {
  sent: boolean;
  provider: "msg91" | "log";
  /** Set when sent is false — distinguishes missing Flow config from API/network failure. */
  failureKind?: "not_configured" | "provider_failed";
};

export type SendCampaignSmsResult = {
  sent: number;
  failed: number;
  provider: "msg91" | "log";
};

export type Msg91WidgetPublicConfig = {
  enabled: boolean;
  widgetId: string | null;
  tokenAuth: string | null;
};

export type VerifyWidgetTokenResult = {
  ok: boolean;
  phone?: string;
  raw?: unknown;
  message?: string;
};

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);

  constructor(private readonly config: PlatformConfigService) {}

  isFlowConfigured(): boolean {
    return Boolean(
      this.config.get("MSG91_AUTH_KEY") && this.config.get("MSG91_TEMPLATE_ID"),
    );
  }

  /** @deprecated Prefer isFlowConfigured / isWidgetConfigured */
  isConfigured(): boolean {
    return this.isWidgetConfigured() || this.isFlowConfigured();
  }

  isWidgetConfigured(): boolean {
    return Boolean(
      this.config.get("MSG91_AUTH_KEY") &&
        this.config.get("MSG91_WIDGET_ID") &&
        this.config.get("MSG91_WIDGET_TOKEN"),
    );
  }

  otpTtlSeconds(): number {
    return Number(this.config.get("MSG91_OTP_TTL_SECONDS") ?? 300);
  }

  status() {
    return {
      configured: this.isConfigured(),
      widgetConfigured: this.isWidgetConfigured(),
      flowConfigured: this.isFlowConfigured(),
      senderId: this.config.get("MSG91_SENDER_ID") ?? null,
      widgetId: this.config.get("MSG91_WIDGET_ID") ? "set" : null,
      templateId: this.config.get("MSG91_TEMPLATE_ID") ? "set" : null,
      otpTtlSeconds: this.otpTtlSeconds(),
    };
  }

  /** Client-safe widget bootstrap (never includes MSG91_AUTH_KEY). */
  getWidgetPublicConfig(): Msg91WidgetPublicConfig {
    const widgetId = this.config.get("MSG91_WIDGET_ID")?.trim() || null;
    const tokenAuth = this.config.get("MSG91_WIDGET_TOKEN")?.trim() || null;
    const authKey = this.config.get("MSG91_AUTH_KEY")?.trim();
    const enabled = Boolean(authKey && widgetId && tokenAuth);
    return {
      enabled,
      widgetId: enabled ? widgetId : null,
      tokenAuth: enabled ? tokenAuth : null,
    };
  }

  private widgetCredentials(): { widgetId: string; tokenAuth: string } | null {
    const widgetId = this.config.get("MSG91_WIDGET_ID")?.trim();
    const tokenAuth = this.config.get("MSG91_WIDGET_TOKEN")?.trim();
    if (!widgetId || !tokenAuth) return null;
    return { widgetId, tokenAuth };
  }

  private async postWidgetApi(
    path: "/sendOtp" | "/sendOtpMobile" | "/verifyOtp" | "/retryOtp",
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; data: Record<string, unknown>; message?: string }> {
    try {
      const res = await fetch(`https://control.msg91.com/api/v5/widget${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          data = parsed as Record<string, unknown>;
        } else {
          data = { raw: parsed };
        }
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        const message =
          String(data.message ?? data.error ?? data.type ?? text).trim() ||
          `MSG91 widget ${path} failed (${res.status})`;
        this.logger.error(`MSG91 widget ${path} failed (${res.status}): ${text}`);
        return { ok: false, data, message };
      }
      const type = String(data.type ?? data.status ?? "").toLowerCase();
      if (
        type.includes("error") ||
        type.includes("fail") ||
        data.hasError === true ||
        data.success === false
      ) {
        const message = String(
          data.message ?? data.error ?? data.type ?? "MSG91 request failed",
        );
        return { ok: false, data, message };
      }
      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`MSG91 widget ${path} error: ${message}`);
      return { ok: false, data: {}, message };
    }
  }

  /** Server-side Widget Send OTP (avoids WebView captcha / emulator IP blocks). */
  async widgetSendOtp(phone: string): Promise<{
    ok: boolean;
    reqId?: string;
    message?: string;
  }> {
    const creds = this.widgetCredentials();
    if (!creds) {
      return { ok: false, message: "MSG91 OTP Widget is not configured" };
    }
    const identifier = this.normalizePhone(phone);
    // Prefer web widget endpoint; fall back to mobile if the widget has Mobile Integration enabled.
    let result = await this.postWidgetApi("/sendOtp", {
      widgetId: creds.widgetId,
      tokenAuth: creds.tokenAuth,
      identifier,
    });
    if (
      !result.ok &&
      /mobile requests are not allowed|not allowed for this widget/i.test(
        result.message ?? "",
      )
    ) {
      result = await this.postWidgetApi("/sendOtpMobile", {
        widgetId: creds.widgetId,
        tokenAuth: creds.tokenAuth,
        identifier,
      });
    }
    if (
      !result.ok &&
      /web requests are not allowed|not allowed for this widget/i.test(
        result.message ?? "",
      )
    ) {
      // Inverse case: widget is mobile-only.
      result = await this.postWidgetApi("/sendOtpMobile", {
        widgetId: creds.widgetId,
        tokenAuth: creds.tokenAuth,
        identifier,
      });
    }
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    const reqId = String(
      result.data.reqId ??
        result.data.requestId ??
        (typeof result.data.message === "string" &&
        /^[a-zA-Z0-9]+$/.test(result.data.message)
          ? result.data.message
          : "") ??
        "",
    ).trim();
    if (!reqId) {
      this.logger.warn(
        `MSG91 widget send missing reqId; keys=${Object.keys(result.data).join(",")}`,
      );
      return {
        ok: false,
        message: "MSG91 did not return a request id. Please try again.",
      };
    }
    return { ok: true, reqId };
  }

  async widgetRetryOtp(reqId: string): Promise<{
    ok: boolean;
    reqId?: string;
    message?: string;
  }> {
    const creds = this.widgetCredentials();
    if (!creds) {
      return { ok: false, message: "MSG91 OTP Widget is not configured" };
    }
    const result = await this.postWidgetApi("/retryOtp", {
      widgetId: creds.widgetId,
      tokenAuth: creds.tokenAuth,
      reqId,
      retryChannel: 11, // SMS
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    const nextReqId = String(
      result.data.reqId ?? result.data.requestId ?? reqId,
    ).trim();
    return { ok: true, reqId: nextReqId || reqId };
  }

  async widgetVerifyOtp(
    reqId: string,
    otp: string,
  ): Promise<{ ok: boolean; accessToken?: string; message?: string }> {
    const creds = this.widgetCredentials();
    if (!creds) {
      return { ok: false, message: "MSG91 OTP Widget is not configured" };
    }
    const result = await this.postWidgetApi("/verifyOtp", {
      widgetId: creds.widgetId,
      tokenAuth: creds.tokenAuth,
      reqId,
      otp: String(otp).trim(),
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    const accessToken = String(
      result.data.message ??
        result.data.accessToken ??
        result.data.token ??
        "",
    ).trim();
    if (!accessToken || accessToken.length < 20) {
      return {
        ok: false,
        message: "MSG91 verify did not return an access token",
      };
    }
    return { ok: true, accessToken };
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
      this.logger.warn(
        `MSG91 Flow not configured. Skipping OTP SMS to ${redactPhone(mobile)}`,
      );
      return { sent: false, provider: "log", failureKind: "not_configured" };
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
        return { sent: false, provider: "log", failureKind: "provider_failed" };
      }

      return { sent: true, provider: "msg91" };
    } catch (err) {
      this.logger.error(
        `MSG91 error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { sent: false, provider: "log", failureKind: "provider_failed" };
    }
  }

  /**
   * Server-side OTP Widget verification.
   * Uses MSG91_AUTH_KEY only — never expose that key to browsers.
   */
  async verifyWidgetAccessToken(accessToken: string): Promise<VerifyWidgetTokenResult> {
    const authKey = this.config.get("MSG91_AUTH_KEY")?.trim();
    const token = accessToken.trim();
    if (!authKey) {
      return { ok: false, message: "MSG91_AUTH_KEY is not configured" };
    }
    if (!token) {
      return { ok: false, message: "access-token is required" };
    }

    try {
      const res = await fetch(
        "https://control.msg91.com/api/v5/widget/verifyAccessToken",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authkey: authKey,
            "access-token": token,
          }),
        },
      );

      const text = await res.text();
      let raw: unknown = text;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        // keep text
      }

      if (!res.ok) {
        this.logger.error(`MSG91 widget verify failed (${res.status}): ${text}`);
        return {
          ok: false,
          message: `MSG91 verify failed (${res.status})`,
          raw,
        };
      }

      const phone =
        extractPhoneFromVerifyPayload(raw) ?? extractPhoneFromJwt(token);
      if (!phone) {
        this.logger.warn(
          `MSG91 widget token verified but phone missing; keys=${
            raw && typeof raw === "object" ? Object.keys(raw as object).join(",") : typeof raw
          }`,
        );
        // Token is valid — caller may supply the widget success identifier.
        return {
          ok: true,
          raw,
          message: "Verified token did not include a phone number",
        };
      }

      return { ok: true, phone: this.normalizePhone(phone), raw };
    } catch (err) {
      this.logger.error(
        `MSG91 widget verify error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  isMarketingConfigured(): boolean {
    return Boolean(
      this.config.get("MSG91_AUTH_KEY") &&
        (this.config.get("MSG91_MARKETING_TEMPLATE_ID") ||
          this.config.get("MSG91_TEMPLATE_ID")),
    );
  }

  /** Bulk marketing SMS via MSG91 Flow (requires marketing template with MESSAGE var). */
  async sendCampaignSms(
    phones: string[],
    message: string,
  ): Promise<SendCampaignSmsResult> {
    const authKey = this.config.get("MSG91_AUTH_KEY");
    const templateId =
      this.config.get("MSG91_MARKETING_TEMPLATE_ID") ??
      this.config.get("MSG91_TEMPLATE_ID");
    const senderId = this.config.get("MSG91_SENDER_ID") ?? "CULLIN";
    const normalized = [...new Set(phones.map((p) => this.normalizePhone(p)))].filter(
      Boolean,
    );

    if (!authKey || !templateId || normalized.length === 0) {
      this.logger.warn(
        `MSG91 marketing not configured or no recipients. Skipping SMS campaign (${normalized.length} recipients)`,
      );
      return { sent: 0, failed: normalized.length, provider: "log" };
    }

    let sent = 0;
    let failed = 0;

    for (const mobile of normalized) {
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
                MESSAGE: message,
                message,
                var: message,
              },
            ],
            sender: senderId,
          }),
        });

        if (res.ok) sent += 1;
        else {
          failed += 1;
          const text = await res.text();
          this.logger.error(
            `MSG91 campaign SMS failed for ${redactPhone(mobile)} (${res.status}): ${text}`,
          );
        }
      } catch (err) {
        failed += 1;
        this.logger.error(
          `MSG91 campaign SMS error for ${redactPhone(mobile)}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { sent, failed, provider: "msg91" };
  }

  /**
   * Best-effort single transactional SMS (invite / confirmation / credentials).
   * Uses marketing or OTP Flow template with MESSAGE var when configured.
   */
  async sendTransactionalSms(
    phone: string,
    message: string,
  ): Promise<{ sent: boolean; provider: "msg91" | "log" }> {
    const result = await this.sendCampaignSms([phone], message);
    return {
      sent: result.sent > 0,
      provider: result.provider,
    };
  }

  async testConfig(phone?: string): Promise<{
    ok: boolean;
    message: string;
    status: ReturnType<Msg91Service["status"]>;
  }> {
    const status = this.status();
    const phoneTrimmed = phone?.trim();

    // Phone provided → attempt Flow SMS test (works even when widget is also configured).
    if (phoneTrimmed) {
      if (!status.flowConfigured) {
        const widgetHint = status.widgetConfigured
          ? " Widget is configured — use customer login for end-to-end OTP, or set Flow template ID (+ sender ID) to send a test SMS from here."
          : "";
        return {
          ok: false,
          message: `Cannot send test SMS: set MSG91_TEMPLATE_ID (and preferably MSG91_SENDER_ID).${widgetHint}`,
          status,
        };
      }
      const otp = "000000";
      const result = await this.sendOtp(phoneTrimmed, otp);
      return {
        ok: result.sent,
        message: result.sent
          ? `Test OTP sent via MSG91 Flow to ${redactPhone(this.normalizePhone(phoneTrimmed))}`
          : "MSG91 send failed (see server logs)",
        status,
      };
    }

    if (status.widgetConfigured) {
      return {
        ok: true,
        message:
          "MSG91 OTP Widget is configured (auth key + widget id + tokenAuth). Enter a phone + set Flow template ID to send a test SMS, or use customer login for widget OTP.",
        status,
      };
    }
    if (!status.flowConfigured) {
      return {
        ok: false,
        message:
          "Configure MSG91_AUTH_KEY + MSG91_WIDGET_ID + MSG91_WIDGET_TOKEN (widget), or AUTH_KEY + TEMPLATE_ID (Flow SMS fallback)",
        status,
      };
    }
    return {
      ok: true,
      message: "MSG91 Flow is configured (enter a phone number to send a test SMS)",
      status,
    };
  }
}

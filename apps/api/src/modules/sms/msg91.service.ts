import { Injectable, Logger } from "@nestjs/common";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import {
  extractPhoneFromJwt,
  extractPhoneFromVerifyPayload,
} from "./msg91-widget.util";
import { redactPhone } from "../../common/pii-redact.util";
import {
  type Msg91FailureLog,
  classifyMsg91Call,
  parseMsg91Body,
  redactMsg91Secrets,
} from "./msg91-response.util";

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/";
const MSG91_VERIFY_ACCESS_TOKEN_URL =
  "https://control.msg91.com/api/v5/widget/verifyAccessToken";

function msg91WidgetUrl(path: string): string {
  return `https://control.msg91.com/api/v5/widget${path}`;
}

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

  /**
   * Log non-2xx responses and HTTP 2xx bodies with type "error".
   * The log line is endpoint, HTTP status, MSG91 code/message, and a masked phone.
   */
  private recordMsg91Call(input: {
    endpoint: string;
    httpStatus: number;
    body: unknown;
    phone?: string | null;
    secrets?: Array<string | null | undefined>;
  }): { httpFailed: boolean; applicationError: boolean } {
    const result = classifyMsg91Call(input);
    if (result.log) this.writeMsg91Failure(result.log.level, result.log.entry);
    return {
      httpFailed: result.httpFailed,
      applicationError: result.applicationError,
    };
  }

  private recordMsg91TransportError(input: {
    endpoint: string;
    phone?: string | null;
    secrets?: Array<string | null | undefined>;
    err: unknown;
  }) {
    const message = input.err instanceof Error ? input.err.message : String(input.err);
    this.writeMsg91Failure("error", {
      endpoint: input.endpoint,
      httpStatus: 0,
      code: null,
      message: redactMsg91Secrets(message, input.secrets),
      phone: redactPhone(input.phone),
    });
  }

  private writeMsg91Failure(level: "warn" | "error", entry: Msg91FailureLog) {
    const line = JSON.stringify(entry);
    if (level === "error") this.logger.error(line);
    else this.logger.warn(line);
  }

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
    meta?: { phone?: string; secrets?: Array<string | null | undefined> },
  ): Promise<{ ok: boolean; data: Record<string, unknown>; message?: string }> {
    const endpoint = msg91WidgetUrl(path);
    try {
      const res = await fetch(endpoint, {
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
      const outcome = this.recordMsg91Call({
        endpoint,
        httpStatus: res.status,
        body: data,
        phone: meta?.phone,
        secrets: meta?.secrets,
      });
      if (!res.ok || outcome.applicationError) {
        const message =
          String(data.message ?? data.error ?? data.type ?? "").trim() ||
          `MSG91 widget ${path} failed (${res.status})`;
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
      this.recordMsg91TransportError({
        endpoint,
        phone: meta?.phone,
        secrets: meta?.secrets,
        err,
      });
      const message = err instanceof Error ? err.message : String(err);
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
    const meta = { phone: identifier, secrets: [creds.tokenAuth] };
    // Prefer web widget endpoint; fall back to mobile if the widget has Mobile Integration enabled.
    let result = await this.postWidgetApi(
      "/sendOtp",
      {
        widgetId: creds.widgetId,
        tokenAuth: creds.tokenAuth,
        identifier,
      },
      meta,
    );
    if (
      !result.ok &&
      /mobile requests are not allowed|not allowed for this widget/i.test(
        result.message ?? "",
      )
    ) {
      result = await this.postWidgetApi(
        "/sendOtpMobile",
        {
          widgetId: creds.widgetId,
          tokenAuth: creds.tokenAuth,
          identifier,
        },
        meta,
      );
    }
    if (
      !result.ok &&
      /web requests are not allowed|not allowed for this widget/i.test(
        result.message ?? "",
      )
    ) {
      // Inverse case: widget is mobile-only.
      result = await this.postWidgetApi(
        "/sendOtpMobile",
        {
          widgetId: creds.widgetId,
          tokenAuth: creds.tokenAuth,
          identifier,
        },
        meta,
      );
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
    const result = await this.postWidgetApi(
      "/retryOtp",
      {
        widgetId: creds.widgetId,
        tokenAuth: creds.tokenAuth,
        reqId,
        retryChannel: 11, // SMS
      },
      { secrets: [creds.tokenAuth] },
    );
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
    const code = String(otp).trim();
    const result = await this.postWidgetApi(
      "/verifyOtp",
      {
        widgetId: creds.widgetId,
        tokenAuth: creds.tokenAuth,
        reqId,
        otp: code,
      },
      { secrets: [creds.tokenAuth, code] },
    );
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

    const secrets = [authKey, otp];
    try {
      const res = await fetch(MSG91_FLOW_URL, {
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

      const body = parseMsg91Body(await res.text());
      const outcome = this.recordMsg91Call({
        endpoint: MSG91_FLOW_URL,
        httpStatus: res.status,
        body,
        phone: mobile,
        secrets,
      });
      if (!res.ok || outcome.applicationError) {
        return { sent: false, provider: "log", failureKind: "provider_failed" };
      }

      return { sent: true, provider: "msg91" };
    } catch (err) {
      this.recordMsg91TransportError({
        endpoint: MSG91_FLOW_URL,
        phone: mobile,
        secrets,
        err,
      });
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

    const secrets = [authKey, token];
    try {
      const res = await fetch(MSG91_VERIFY_ACCESS_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authkey: authKey,
          "access-token": token,
        }),
      });

      const text = await res.text();
      let raw: unknown = text;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        // keep text
      }

      const outcome = this.recordMsg91Call({
        endpoint: MSG91_VERIFY_ACCESS_TOKEN_URL,
        httpStatus: res.status,
        body: typeof raw === "string" ? parseMsg91Body(raw) : raw,
        phone: extractPhoneFromVerifyPayload(raw),
        secrets,
      });
      if (!res.ok || outcome.applicationError) {
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
        // Callers must fail closed — never substitute a client-supplied phone.
        return {
          ok: true,
          raw,
          message: "Verified token did not include a phone number",
        };
      }

      return { ok: true, phone: this.normalizePhone(phone), raw };
    } catch (err) {
      this.recordMsg91TransportError({
        endpoint: MSG91_VERIFY_ACCESS_TOKEN_URL,
        secrets,
        err,
      });
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
        const res = await fetch(MSG91_FLOW_URL, {
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

        const body = parseMsg91Body(await res.text());
        const outcome = this.recordMsg91Call({
          endpoint: MSG91_FLOW_URL,
          httpStatus: res.status,
          body,
          phone: mobile,
          secrets: [authKey],
        });
        if (!res.ok || outcome.applicationError) failed += 1;
        else sent += 1;
      } catch (err) {
        failed += 1;
        this.recordMsg91TransportError({
          endpoint: MSG91_FLOW_URL,
          phone: mobile,
          secrets: [authKey],
          err,
        });
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
          ? " Widget is configured — Guest and Waiter use Widget OTP; set Flow template ID (+ sender ID) only if you need Flow SMS test or marketing."
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
          "MSG91 OTP Widget is configured (auth key + widget id + tokenAuth). Guest and Waiter phone OTP use Widget. Enter a phone + set Flow template ID to send a Flow test SMS.",
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

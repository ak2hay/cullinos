import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformConfigService } from "../platform-config/platform-config.service";
import { Msg91Service } from "./msg91.service";

const AUTH_KEY = "msg91-auth-key-do-not-log";
const WIDGET_TOKEN = "widget-token-do-not-log";
const OTP = "654321";
const PHONE = "9876543210";
const MASKED_PHONE = "***3210";

const FLOW_URL = "https://control.msg91.com/api/v5/flow/";
const VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";

type FailureLog = {
  endpoint: string;
  httpStatus: number;
  code: string | null;
  message: string | null;
  phone: string;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeService(): Msg91Service {
  const values: Record<string, string> = {
    MSG91_AUTH_KEY: AUTH_KEY,
    MSG91_TEMPLATE_ID: "template-otp",
    MSG91_MARKETING_TEMPLATE_ID: "template-marketing",
    MSG91_SENDER_ID: "CULLIN",
    MSG91_WIDGET_ID: "widget-1",
    MSG91_WIDGET_TOKEN: WIDGET_TOKEN,
  };
  const config = {
    get: (key: string) => values[key],
  } as PlatformConfigService;
  return new Msg91Service(config);
}

function mockFetch(status: number, body: unknown) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const fetchMock = vi.fn().mockImplementation(
    () =>
      new Response(payload, {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function spyLogs(service: Msg91Service) {
  const logger = (service as unknown as { logger: Logger }).logger;
  return {
    warn: vi.spyOn(logger, "warn").mockImplementation(() => undefined),
    error: vi.spyOn(logger, "error").mockImplementation(() => undefined),
  };
}

function failureLogs(spy: { mock: { calls: unknown[][] } }): FailureLog[] {
  return spy.mock.calls
    .map((call) => call[0])
    .filter(
      (message): message is string =>
        typeof message === "string" && message.includes("\"httpStatus\""),
    )
    .map((message) => JSON.parse(message) as FailureLog);
}

function loggedText(spies: { warn: { mock: { calls: unknown[][] } }; error: { mock: { calls: unknown[][] } } }): string {
  return [...spies.warn.mock.calls, ...spies.error.mock.calls]
    .flat()
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join("\n");
}

function assertNoSecrets(text: string, extra: string[] = []) {
  expect(text).not.toContain(AUTH_KEY);
  expect(text).not.toContain(WIDGET_TOKEN);
  expect(text).not.toContain(OTP);
  expect(text).not.toContain("919876543210");
  expect(text).not.toContain(PHONE);
  for (const secret of extra) expect(text).not.toContain(secret);
}

describe("Msg91Service MSG91 error bodies", () => {
  it("treats Flow SMS HTTP 200 type:error as a provider failure and warns", async () => {
    const fetchMock = mockFetch(200, {
      type: "error",
      code: "418",
      message: `IPBlocked for ${OTP} key ${AUTH_KEY}`,
      authkey: AUTH_KEY,
    });
    const service = makeService();
    const logs = spyLogs(service);

    const result = await service.sendOtp(PHONE, OTP);

    expect(result).toEqual({
      sent: false,
      provider: "log",
      failureKind: "provider_failed",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(FLOW_URL);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body)).recipients[0].OTP).toBe(OTP);

    const entries = failureLogs(logs.warn);
    expect(failureLogs(logs.error)).toEqual([]);
    expect(entries).toEqual([
      {
        endpoint: FLOW_URL,
        httpStatus: 200,
        code: "418",
        message: "IPBlocked for [redacted] key [redacted]",
        phone: MASKED_PHONE,
      },
    ]);
    assertNoSecrets(loggedText(logs));
  });

  it("logs Flow SMS non-2xx as error without the response body", async () => {
    mockFetch(401, `denied ${AUTH_KEY} ${OTP}`);
    const service = makeService();
    const logs = spyLogs(service);

    const result = await service.sendOtp(PHONE, OTP);

    expect(result.sent).toBe(false);
    expect(result.failureKind).toBe("provider_failed");
    expect(failureLogs(logs.error)).toEqual([
      {
        endpoint: FLOW_URL,
        httpStatus: 401,
        code: null,
        message: null,
        phone: MASKED_PHONE,
      },
    ]);
    assertNoSecrets(loggedText(logs));
  });

  it("accepts a Flow SMS success body without logging", async () => {
    mockFetch(200, { type: "success", message: "3666636b704c353735313833" });
    const service = makeService();
    const logs = spyLogs(service);

    await expect(service.sendOtp(PHONE, OTP)).resolves.toEqual({
      sent: true,
      provider: "msg91",
    });
    expect(failureLogs(logs.warn)).toEqual([]);
    expect(failureLogs(logs.error)).toEqual([]);
  });

  it("counts a campaign Flow SMS type:error as failed", async () => {
    mockFetch(200, { type: "error", message: "418" });
    const service = makeService();
    const logs = spyLogs(service);

    await expect(service.sendCampaignSms([PHONE], "Today only")).resolves.toEqual({
      sent: 0,
      failed: 1,
      provider: "msg91",
    });
    expect(failureLogs(logs.warn)[0]).toMatchObject({
      endpoint: FLOW_URL,
      httpStatus: 200,
      code: "418",
      message: "418",
      phone: MASKED_PHONE,
    });
    assertNoSecrets(loggedText(logs));
  });

  it("logs widget send and retry type:error and returns ok:false", async () => {
    const fetchMock = mockFetch(200, {
      type: "error",
      code: 418,
      message: "IPBlocked",
      tokenAuth: WIDGET_TOKEN,
    });
    const service = makeService();
    const logs = spyLogs(service);

    await expect(service.widgetSendOtp(PHONE)).resolves.toEqual({
      ok: false,
      message: "IPBlocked",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://control.msg91.com/api/v5/widget/sendOtp",
    );
    const sendBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(sendBody.tokenAuth).toBe(WIDGET_TOKEN);
    expect(failureLogs(logs.warn)).toEqual([
      {
        endpoint: "https://control.msg91.com/api/v5/widget/sendOtp",
        httpStatus: 200,
        code: "418",
        message: "IPBlocked",
        phone: MASKED_PHONE,
      },
    ]);

    logs.warn.mockClear();
    await expect(service.widgetRetryOtp("req-abc")).resolves.toEqual({
      ok: false,
      message: "IPBlocked",
    });
    expect(failureLogs(logs.warn)).toEqual([
      {
        endpoint: "https://control.msg91.com/api/v5/widget/retryOtp",
        httpStatus: 200,
        code: "418",
        message: "IPBlocked",
        phone: "[no-phone]",
      },
    ]);
    assertNoSecrets(loggedText(logs));
  });

  it("logs widget send HTTP errors without dumping the response body", async () => {
    mockFetch(500, {
      message: "provider unavailable",
      authkey: AUTH_KEY,
      tokenAuth: WIDGET_TOKEN,
      otp: OTP,
    });
    const service = makeService();
    const logs = spyLogs(service);

    const result = await service.widgetSendOtp(PHONE);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("provider unavailable");
    expect(failureLogs(logs.error)).toEqual([
      {
        endpoint: "https://control.msg91.com/api/v5/widget/sendOtp",
        httpStatus: 500,
        code: null,
        message: "provider unavailable",
        phone: MASKED_PHONE,
      },
    ]);
    assertNoSecrets(loggedText(logs));
  });

  it("rejects verifyAccessToken type:error even when the token carries a phone", async () => {
    const payload = Buffer.from(JSON.stringify({ mobile: "919876543210" })).toString(
      "base64url",
    );
    const accessToken = `eyJhbGciOiJub25lIn0.${payload}.signature`;
    mockFetch(200, {
      type: "error",
      code: "701",
      message: `Invalid access token ${accessToken}`,
      mobile: "919876543210",
    });
    const service = makeService();
    const logs = spyLogs(service);

    const result = await service.verifyWidgetAccessToken(accessToken);

    expect(result.ok).toBe(false);
    expect(result.phone).toBeUndefined();
    expect(result.message).toBe("MSG91 verify failed (200)");
    expect(failureLogs(logs.warn)).toEqual([
      {
        endpoint: VERIFY_URL,
        httpStatus: 200,
        code: "701",
        message: "Invalid access token [redacted]",
        phone: MASKED_PHONE,
      },
    ]);
    expect(failureLogs(logs.error)).toEqual([]);
    assertNoSecrets(loggedText(logs), [accessToken, payload]);
  });

  it("keeps the existing verifyAccessToken failure message for non-2xx", async () => {
    mockFetch(401, { type: "error", code: "701", message: "Invalid access token" });
    const service = makeService();
    const logs = spyLogs(service);
    const accessToken = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJndWVzdCJ9.signature";

    const result = await service.verifyWidgetAccessToken(accessToken);

    expect(result).toMatchObject({
      ok: false,
      message: "MSG91 verify failed (401)",
    });
    expect(failureLogs(logs.error)[0]).toMatchObject({
      endpoint: VERIFY_URL,
      httpStatus: 401,
      code: "701",
      message: "Invalid access token",
    });
    assertNoSecrets(loggedText(logs), [accessToken]);
  });

  it("still verifies a successful access token", async () => {
    mockFetch(200, {
      type: "success",
      message: "verified",
      data: { mobile: "919876543210" },
    });
    const service = makeService();
    const logs = spyLogs(service);

    const result = await service.verifyWidgetAccessToken(
      "eyJhbGciOiJub25lIn0.eyJzdWIiOiJndWVzdCJ9.signature",
    );

    expect(result.ok).toBe(true);
    expect(result.phone).toBe("919876543210");
    expect(failureLogs(logs.warn)).toEqual([]);
    expect(failureLogs(logs.error)).toEqual([]);
  });
});

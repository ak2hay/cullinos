import { describe, expect, it } from "vitest";
import { classifyMsg91Call, parseMsg91Body, redactMsg91Secrets } from "./msg91-response.util";

const ENDPOINT = "https://control.msg91.com/api/v5/flow/";
const AUTH_KEY = "msg91-auth-key-do-not-log";
const OTP = "654321";

describe("classifyMsg91Call", () => {
  it("warns on HTTP 200 with type error, code, and a masked phone", () => {
    const result = classifyMsg91Call({
      endpoint: ENDPOINT,
      httpStatus: 200,
      phone: "919876543210",
      secrets: [AUTH_KEY, OTP],
      body: { type: "error", code: "418", message: "IPBlocked" },
    });

    expect(result.httpFailed).toBe(false);
    expect(result.applicationError).toBe(true);
    expect(result.log?.level).toBe("warn");
    expect(result.log?.entry).toEqual({
      endpoint: ENDPOINT,
      httpStatus: 200,
      code: "418",
      message: "IPBlocked",
      phone: "***3210",
    });
    const serialized = JSON.stringify(result.log);
    expect(serialized).not.toContain(AUTH_KEY);
    expect(serialized).not.toContain(OTP);
    expect(serialized).not.toContain("919876543210");
  });

  it("treats a numeric message as the MSG91 code (418 / 701)", () => {
    const ipLocked = classifyMsg91Call({
      endpoint: ENDPOINT,
      httpStatus: 200,
      body: { type: "Error", message: 418 },
    });
    expect(ipLocked.applicationError).toBe(true);
    expect(ipLocked.log?.entry.code).toBe("418");
    expect(ipLocked.log?.entry.message).toBe("418");

    const invalidToken = classifyMsg91Call({
      endpoint: "https://control.msg91.com/api/v5/widget/verifyAccessToken",
      httpStatus: 200,
      body: { type: "error", code: 701, message: "Invalid access token" },
    });
    expect(invalidToken.log?.entry).toMatchObject({
      httpStatus: 200,
      code: "701",
      message: "Invalid access token",
      phone: "[no-phone]",
    });
  });

  it("logs non-2xx as error even when the body is not JSON", () => {
    const result = classifyMsg91Call({
      endpoint: ENDPOINT,
      httpStatus: 401,
      phone: "9876543210",
      body: parseMsg91Body("<html>authkey=secret</html>"),
    });
    expect(result.httpFailed).toBe(true);
    expect(result.applicationError).toBe(false);
    expect(result.log?.level).toBe("error");
    expect(result.log?.entry.code).toBeNull();
    expect(result.log?.entry.message).toBeNull();
    expect(result.log?.entry.phone).toBe("***3210");
    expect(JSON.stringify(result.log)).not.toContain("authkey");
  });

  it("does not log a success body and ignores extra payload fields", () => {
    const body = {
      type: "success",
      message: "3666636b704c353735313833",
      authkey: AUTH_KEY,
      tokenAuth: "widget-token-do-not-log",
      otp: OTP,
    };
    const result = classifyMsg91Call({
      endpoint: ENDPOINT,
      httpStatus: 200,
      phone: "919876543210",
      body,
    });
    expect(result.applicationError).toBe(false);
    expect(result.log).toBeNull();
  });

  it("strips secrets, JWTs, and full phone numbers from the logged message", () => {
    const token = "eyJhbGciOiJub25lIn0.eyJtb2JpbGUiOiI5MTk4NzY1NDMyMTAifQ.signature";
    const result = classifyMsg91Call({
      endpoint: ENDPOINT,
      httpStatus: 200,
      phone: "919876543210",
      secrets: [AUTH_KEY, OTP, token],
      body: {
        type: "error",
        code: "701",
        message: `rejected ${OTP} for 919876543210 key ${AUTH_KEY} token ${token}`,
        authkey: AUTH_KEY,
        "access-token": token,
      },
    });
    const serialized = JSON.stringify(result.log?.entry);
    expect(result.log?.entry.message).not.toContain(OTP);
    expect(result.log?.entry.message).not.toContain(AUTH_KEY);
    expect(result.log?.entry.message).not.toContain("919876543210");
    expect(serialized).not.toContain(OTP);
    expect(serialized).not.toContain(AUTH_KEY);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("919876543210");
    expect(result.log?.entry.message).toContain("***3210");
    expect(result.log?.entry.code).toBe("701");
  });
});

describe("redactMsg91Secrets", () => {
  it("returns null for an empty message", () => {
    expect(redactMsg91Secrets("   ", ["secret-value"])).toBeNull();
    expect(redactMsg91Secrets(null, [])).toBeNull();
  });
});

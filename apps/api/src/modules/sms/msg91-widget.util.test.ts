import { describe, expect, it } from "vitest";
import {
  extractMsg91AccessTokenFromClientPayload,
  extractPhoneFromJwt,
  extractPhoneFromVerifyPayload,
  looksLikePhone,
} from "./msg91-widget.util";

describe("MSG91 widget phone extraction", () => {
  it("reads phone from verify payload object", () => {
    expect(
      extractPhoneFromVerifyPayload({
        type: "success",
        data: { mobile: "919876543210" },
      }),
    ).toBe("919876543210");
  });

  it("reads phone when data is a plain mobile string", () => {
    expect(
      extractPhoneFromVerifyPayload({
        type: "success",
        data: "919876543210",
      }),
    ).toBe("919876543210");
  });

  it("reads identifier from success-shaped payload", () => {
    expect(
      extractPhoneFromVerifyPayload({
        success: true,
        identifier: "9197057026024",
        message: "eyJhbGciOiJIUzI1NiJ9.e30.sig",
      }),
    ).toBe("9197057026024");
  });

  it("reads phone from JWT payload", () => {
    const payload = Buffer.from(
      JSON.stringify({ mobile: "919811122233", iat: 1 }),
    ).toString("base64url");
    const token = `hdr.${payload}.sig`;
    expect(extractPhoneFromJwt(token)).toBe("919811122233");
  });

  it("reads phone from JWT identifier claim", () => {
    const payload = Buffer.from(
      JSON.stringify({ identifier: "7057026024", iat: 1 }),
    ).toString("base64url");
    const token = `hdr.${payload}.sig`;
    expect(extractPhoneFromJwt(token)).toBe("7057026024");
  });

  it("reads access token from widget success payload", () => {
    expect(extractMsg91AccessTokenFromClientPayload({ message: "jwt.here" })).toBe(
      "jwt.here",
    );
  });

  it("detects phone-like strings", () => {
    expect(looksLikePhone("7057026024")).toBe(true);
    expect(looksLikePhone("+91 70570 26024")).toBe(true);
    expect(looksLikePhone("not-a-phone")).toBe(false);
  });
});

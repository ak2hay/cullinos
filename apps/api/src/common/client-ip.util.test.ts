import { describe, expect, it } from "vitest";
import { clientIp, parseTrustProxyHops } from "./client-ip.util";

describe("parseTrustProxyHops", () => {
  it("defaults to one proxy hop", () => {
    expect(parseTrustProxyHops(undefined)).toBe(1);
    expect(parseTrustProxyHops("")).toBe(1);
  });

  it("accepts explicit non-negative integers", () => {
    expect(parseTrustProxyHops("0")).toBe(0);
    expect(parseTrustProxyHops("2")).toBe(2);
  });

  it("falls back to one hop for invalid values", () => {
    expect(parseTrustProxyHops("-1")).toBe(1);
    expect(parseTrustProxyHops("true")).toBe(1);
    expect(parseTrustProxyHops("1.5")).toBe(1);
  });
});

describe("clientIp", () => {
  it("uses the proxy-resolved req.ip, never a raw X-Forwarded-For value", () => {
    const req = { ip: "203.0.113.9", headers: { "x-forwarded-for": "1.1.1.1" } };
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  it("returns undefined when Express has no ip", () => {
    expect(clientIp({ ip: undefined })).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry.init";

describe("scrubSentryEvent", () => {
  it("removes bodies, cookies, credentials and personal data", () => {
    const event = scrubSentryEvent({
      request: {
        headers: { authorization: "Bearer abc", "user-agent": "ua", Cookie: "sid=1" },
        cookies: { sid: "1" },
        data: { phone: "9999999999", otp: "123456" },
        query_string: "otp=123456&page=2",
        url: "https://api.cullinos.com/api/v1/x?token=secret&page=2",
      },
      user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4" },
    });

    expect(event.request?.headers).toEqual({
      authorization: "[Filtered]",
      "user-agent": "ua",
      Cookie: "[Filtered]",
    });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.query_string).toBe("otp=[Filtered]&page=2");
    expect(event.request?.url).toBe("https://api.cullinos.com/api/v1/x?token=[Filtered]&page=2");
    expect(event.user).toEqual({ id: "u1" });
  });
});

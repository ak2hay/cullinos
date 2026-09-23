import { describe, expect, it } from "vitest";
import { redactEmail, redactPhone, redactRecipientList } from "./pii-redact.util";

describe("pii-redact.util", () => {
  it("redacts emails", () => {
    expect(redactEmail("alice@example.com")).toBe("a***e@example.com");
    expect(redactEmail("")).toBe("[no-email]");
  });

  it("redacts phones", () => {
    expect(redactPhone("919876543210")).toBe("***3210");
    expect(redactPhone(null)).toBe("[no-phone]");
  });

  it("redacts recipient lists", () => {
    expect(redactRecipientList(["bob@x.com", "9876543210"])).toContain("@x.com");
  });
});

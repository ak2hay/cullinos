import { describe, expect, it } from "vitest";
import {
  friendlyMsg91WidgetMessage,
  staffWidgetPhonesMatch,
} from "./msg91-widget-messages";

describe("friendlyMsg91WidgetMessage", () => {
  it("maps empty to generic retry copy", () => {
    expect(friendlyMsg91WidgetMessage()).toMatch(/try again/i);
  });

  it("maps captcha / IP / mobile-integration hints", () => {
    expect(friendlyMsg91WidgetMessage("Captcha required")).toMatch(/Captcha Validation/i);
    expect(friendlyMsg91WidgetMessage("IPBlocked")).toMatch(/blocked this network IP/i);
    expect(friendlyMsg91WidgetMessage("Mobile requests are not allowed")).toMatch(
      /Mobile Integration/i,
    );
  });
});

describe("staffWidgetPhonesMatch", () => {
  it("matches same E.164 / local forms", () => {
    expect(staffWidgetPhonesMatch("919876543210", "919876543210")).toBe(true);
    expect(staffWidgetPhonesMatch("919876543210", "9876543210")).toBe(true);
    expect(staffWidgetPhonesMatch("9876543210", "919876543210")).toBe(true);
  });

  it("rejects different numbers", () => {
    expect(staffWidgetPhonesMatch("919876543210", "919111111111")).toBe(false);
    expect(staffWidgetPhonesMatch("91", "91")).toBe(false);
  });
});

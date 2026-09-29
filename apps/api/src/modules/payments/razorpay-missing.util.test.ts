import { describe, expect, it } from "vitest";
import { razorpayMessageLooksMissing } from "./razorpay-missing.util";

describe("razorpayMessageLooksMissing", () => {
  it("matches Razorpay plan fetch wording from production", () => {
    expect(
      razorpayMessageLooksMissing(
        "The ID provided is invalid or could not be found.",
      ),
    ).toBe(true);
  });

  it("matches subscription create wording", () => {
    expect(razorpayMessageLooksMissing("The id provided does not exist")).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(razorpayMessageLooksMissing("Amount must be at least 100 paise")).toBe(false);
  });
});

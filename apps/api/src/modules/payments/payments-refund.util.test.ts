import { describe, expect, it } from "vitest";
import { planPaymentRefund } from "./payments-refund.util";

describe("planPaymentRefund", () => {
  it("plans a local cash refund", () => {
    expect(
      planPaymentRefund({
        id: "pay_cash",
        amount: 120.5,
        metadata: { tender: "cash", kind: "diner" },
      }),
    ).toEqual({ action: "cash", amount: 120.5 });
  });

  it("plans a full Razorpay refund from the stored payment id", () => {
    const plan = planPaymentRefund({
      id: "clpay1",
      amount: "250.00",
      reference: "pay_abc",
      metadata: { provider: "razorpay", razorpayPaymentId: "pay_abc" },
    });
    expect(plan).toMatchObject({
      action: "razorpay",
      razorpayPaymentId: "pay_abc",
      amountPaise: 25000,
    });
  });

  it("does not treat a Razorpay order id as a payment id", () => {
    const plan = planPaymentRefund({
      id: "clpay2",
      amount: 100,
      reference: "order_xyz",
      metadata: { provider: "razorpay", razorpayOrderId: "order_xyz" },
    });
    expect(plan.action).toBe("unsupported");
  });

  it("plans a Cashfree refund from the stored order id", () => {
    const plan = planPaymentRefund({
      id: "clpay3",
      amount: 80,
      metadata: { provider: "cashfree", cashfreeOrderId: "cf_clpay3" },
    });
    expect(plan).toMatchObject({
      action: "cashfree",
      cashfreeOrderId: "cf_clpay3",
      amount: 80,
    });
  });
});

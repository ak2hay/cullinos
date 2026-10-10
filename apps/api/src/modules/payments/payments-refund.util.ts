/** Response code when staff must confirm a refund already made outside Cullinos. */
export const EXTERNAL_REFUND_CODE = "EXTERNAL_REFUND_REQUIRED";

export function externalRefundBody(message: string) {
  return { message, code: EXTERNAL_REFUND_CODE };
}

export function isDuplicateGatewayRefund(message: string): boolean {
  return /already exists|duplicate refund|refund.{0,40}already/i.test(message);
}

export type RefundablePayment = {
  id: string;
  amount: unknown;
  reference?: string | null;
  metadata?: unknown;
  paymentMethod?: { code?: string | null } | null;
};

export type PaymentRefundPlan =
  | { action: "cash"; amount: number }
  | { action: "razorpay"; razorpayPaymentId: string; amountPaise: number; receipt: string }
  | { action: "cashfree"; cashfreeOrderId: string; amount: number; refundId: string }
  | { action: "unsupported"; reason: string };

type PaymentMeta = {
  tender?: string;
  provider?: string;
  razorpayPaymentId?: string;
  cashfreeOrderId?: string;
};

export function refundRupees(amount: unknown): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function readMeta(metadata: unknown): PaymentMeta {
  if (!metadata || typeof metadata !== "object") return {};
  const row = metadata as Record<string, unknown>;
  return {
    tender: typeof row.tender === "string" ? row.tender : undefined,
    provider: typeof row.provider === "string" ? row.provider : undefined,
    razorpayPaymentId:
      typeof row.razorpayPaymentId === "string" ? row.razorpayPaymentId : undefined,
    cashfreeOrderId:
      typeof row.cashfreeOrderId === "string" ? row.cashfreeOrderId : undefined,
  };
}

function refundReceipt(paymentId: string): string {
  return `rf_${paymentId}`.replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);
}

export function planPaymentRefund(payment: RefundablePayment): PaymentRefundPlan {
  const amount = refundRupees(payment.amount);
  if (amount <= 0) {
    return { action: "unsupported", reason: "This payment has no refundable amount." };
  }

  const meta = readMeta(payment.metadata);
  const reference = payment.reference?.trim() || undefined;
  const method = payment.paymentMethod?.code?.toLowerCase();
  const isCash =
    meta.tender === "cash" ||
    (method === "cash" && !meta.provider && !meta.razorpayPaymentId && !meta.cashfreeOrderId);

  if (isCash && meta.provider !== "razorpay" && meta.provider !== "cashfree") {
    return { action: "cash", amount };
  }

  if (meta.provider === "razorpay" || meta.razorpayPaymentId) {
    const razorpayPaymentId = meta.razorpayPaymentId?.startsWith("pay_")
      ? meta.razorpayPaymentId
      : reference?.startsWith("pay_")
        ? reference
        : undefined;
    if (!razorpayPaymentId) {
      return {
        action: "unsupported",
        reason:
          "No Razorpay payment id is stored, so Cullinos cannot send this refund. Refund it in the Razorpay dashboard, then confirm the external refund to cancel.",
      };
    }
    const amountPaise = Math.round(amount * 100);
    if (amountPaise < 100) {
      return {
        action: "unsupported",
        reason: "Razorpay refunds must be at least ₹1.00. Refund this payment in the Razorpay dashboard, then confirm the external refund.",
      };
    }
    const receipt = refundReceipt(payment.id);
    if (!receipt) {
      return { action: "unsupported", reason: "This payment cannot be refunded in Cullinos." };
    }
    return { action: "razorpay", razorpayPaymentId, amountPaise, receipt };
  }

  if (meta.provider === "cashfree" || meta.cashfreeOrderId) {
    const cashfreeOrderId = meta.cashfreeOrderId ?? reference;
    if (!cashfreeOrderId) {
      return {
        action: "unsupported",
        reason:
          "No Cashfree order id is stored, so Cullinos cannot send this refund. Refund it in the Cashfree dashboard, then confirm the external refund to cancel.",
      };
    }
    if (amount < 1) {
      return {
        action: "unsupported",
        reason: "Cashfree refunds must be at least ₹1.00. Refund this payment in the Cashfree dashboard, then confirm the external refund.",
      };
    }
    const refundId = refundReceipt(payment.id);
    if (!refundId) {
      return { action: "unsupported", reason: "This payment cannot be refunded in Cullinos." };
    }
    return { action: "cashfree", cashfreeOrderId, amount, refundId };
  }

  return {
    action: "unsupported",
    reason:
      "Cullinos cannot refund this payment in the app. Refund it with the provider, then confirm the external refund to cancel.",
  };
}

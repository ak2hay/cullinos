/** True when Razorpay error text indicates a missing/invalid resource id. */
export function razorpayMessageLooksMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not be found") ||
    m.includes("not found") ||
    m.includes("invalid") ||
    m.includes("no such")
  );
}

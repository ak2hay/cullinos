/** When recipe ingredients leave stock for an order: on KOT (sent to kitchen) or on served/completed. */
export type StockDeductionTrigger = "kot" | "served";

export function stockDeductionTrigger(settings: unknown): StockDeductionTrigger {
  const s =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  return s.stockDeductionTrigger === "kot" ? "kot" : "served";
}

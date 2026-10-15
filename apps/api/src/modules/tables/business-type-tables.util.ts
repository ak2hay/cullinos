import { outletUsesTables } from "@cullinos/shared";

export const TABLES_OFF_MESSAGE = "This outlet is not using tables. Scan the counter QR to order.";

/**
 * Whether an outlet runs the table system: its `tablesEnabled` setting wins,
 * otherwise the business type decides. Unknown/legacy business types keep
 * table access so existing tenants are not locked out.
 */
export function outletUsesTablesFor(
  businessType: string | null | undefined,
  outletSettings: unknown,
): boolean {
  return outletUsesTables(businessType, outletSettings);
}

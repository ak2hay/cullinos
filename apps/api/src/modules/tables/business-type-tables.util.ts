import { getBusinessTypeRules, isBusinessType } from "@cullinos/shared";

/** Unknown/legacy business types keep table access so existing tenants are not locked out. */
export function businessTypeUsesTables(businessType: string | null | undefined): boolean {
  if (!isBusinessType(businessType)) return true;
  return getBusinessTypeRules(businessType).tables;
}

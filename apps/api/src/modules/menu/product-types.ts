import { BadRequestException } from "@nestjs/common";

/** Keep in sync with PRODUCT_TYPE_PRESETS in apps/admin/src/features/menu/productTypes.ts */
export const MENU_PRODUCT_TYPES = [
  "other",
  "tea_coffee",
  "juice_shake",
  "cold_drink",
  "packaged_water",
  "pizza",
  "burger_sandwich",
  "main_course",
  "biryani_rice",
  "dessert",
  "alcohol",
] as const;

export type MenuProductType = (typeof MENU_PRODUCT_TYPES)[number];

/** `other` and empty values are stored as NULL. */
export function normalizeProductType(value: unknown): MenuProductType | null {
  if (value == null || value === "" || value === "other") return null;
  if (typeof value === "string" && (MENU_PRODUCT_TYPES as readonly string[]).includes(value)) {
    return value as MenuProductType;
  }
  throw new BadRequestException("Invalid productType");
}

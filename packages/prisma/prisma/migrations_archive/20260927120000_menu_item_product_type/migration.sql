-- Built-in product type preset on menu items (tea, cold drink, pizza, ...). NULL = other/general.

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "product_type" TEXT;

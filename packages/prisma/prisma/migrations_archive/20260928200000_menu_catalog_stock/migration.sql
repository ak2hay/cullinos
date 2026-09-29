-- Universal menu catalog import + pack-aware key-component stock
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "pack_label" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "pack_size" DECIMAL(12,3);
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "catalog_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_organization_id_outlet_id_catalog_key_key"
  ON "inventory_items"("organization_id", "outlet_id", "catalog_key");

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "catalog_item_id" TEXT;

CREATE INDEX IF NOT EXISTS "menu_items_organization_id_catalog_item_id_idx"
  ON "menu_items"("organization_id", "catalog_item_id");

ALTER TABLE "menu_item_variants" ADD COLUMN IF NOT EXISTS "stock_multiplier" DECIMAL(8,3) NOT NULL DEFAULT 1;

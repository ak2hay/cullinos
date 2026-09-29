-- Phase 2 menu catalog: packaging charge, online availability, stock-based flag

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "packaging_charge" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "online_available" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "stock_based_availability" BOOLEAN NOT NULL DEFAULT false;

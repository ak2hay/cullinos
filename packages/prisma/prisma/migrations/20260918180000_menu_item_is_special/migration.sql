-- Phase G: special dishes flag on menu items (max 5 enforced in API)

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "is_special" BOOLEAN NOT NULL DEFAULT false;

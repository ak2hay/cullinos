-- Guest Phase 2: favorites, reviews, notifications, service request types

CREATE TABLE IF NOT EXISTS "guest_favorite_outlets" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "outlet_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_favorite_outlets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_favorite_outlets_guest_user_id_outlet_id_key"
  ON "guest_favorite_outlets"("guest_user_id", "outlet_id");
CREATE INDEX IF NOT EXISTS "guest_favorite_outlets_outlet_id_idx"
  ON "guest_favorite_outlets"("outlet_id");

CREATE TABLE IF NOT EXISTS "guest_favorite_items" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "menu_item_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_favorite_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_favorite_items_guest_user_id_menu_item_id_key"
  ON "guest_favorite_items"("guest_user_id", "menu_item_id");
CREATE INDEX IF NOT EXISTS "guest_favorite_items_organization_id_idx"
  ON "guest_favorite_items"("organization_id");

CREATE TABLE IF NOT EXISTS "guest_outlet_reviews" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "outlet_id" TEXT NOT NULL,
  "order_id" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_outlet_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_outlet_reviews_order_id_key"
  ON "guest_outlet_reviews"("order_id");
CREATE INDEX IF NOT EXISTS "guest_outlet_reviews_outlet_id_created_at_idx"
  ON "guest_outlet_reviews"("outlet_id", "created_at");
CREATE INDEX IF NOT EXISTS "guest_outlet_reviews_guest_user_id_idx"
  ON "guest_outlet_reviews"("guest_user_id");

CREATE TABLE IF NOT EXISTS "guest_notifications" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'general',
  "data" JSONB NOT NULL DEFAULT '{}',
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "guest_notifications_guest_user_id_created_at_idx"
  ON "guest_notifications"("guest_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "guest_notification_preferences" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "transactional_enabled" BOOLEAN NOT NULL DEFAULT true,
  "marketing_enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_notification_preferences_guest_user_id_key"
  ON "guest_notification_preferences"("guest_user_id");

DO $$ BEGIN
  ALTER TABLE "guest_favorite_outlets"
    ADD CONSTRAINT "guest_favorite_outlets_guest_user_id_fkey"
    FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_favorite_outlets"
    ADD CONSTRAINT "guest_favorite_outlets_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_favorite_items"
    ADD CONSTRAINT "guest_favorite_items_guest_user_id_fkey"
    FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_favorite_items"
    ADD CONSTRAINT "guest_favorite_items_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_outlet_reviews"
    ADD CONSTRAINT "guest_outlet_reviews_guest_user_id_fkey"
    FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_outlet_reviews"
    ADD CONSTRAINT "guest_outlet_reviews_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_outlet_reviews"
    ADD CONSTRAINT "guest_outlet_reviews_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_notifications"
    ADD CONSTRAINT "guest_notifications_guest_user_id_fkey"
    FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "guest_notification_preferences"
    ADD CONSTRAINT "guest_notification_preferences_guest_user_id_fkey"
    FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend service request enum values (Postgres)
DO $$ BEGIN
  ALTER TYPE "ServiceRequestType" ADD VALUE IF NOT EXISTS 'cutlery';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "ServiceRequestType" ADD VALUE IF NOT EXISTS 'napkins';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "ServiceRequestType" ADD VALUE IF NOT EXISTS 'other';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

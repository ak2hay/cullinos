-- Cullinos Guest marketplace: platform identity, outlet discovery, delivery order fields

ALTER TABLE "outlets"
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "cuisine_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "cover_image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "marketplace_listed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "average_prep_minutes" INTEGER;

CREATE INDEX IF NOT EXISTS "outlets_marketplace_listed_status_idx" ON "outlets"("marketplace_listed", "status");
CREATE INDEX IF NOT EXISTS "outlets_city_idx" ON "outlets"("city");

CREATE TABLE IF NOT EXISTS "guest_users" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "marketing_email_opt_in" BOOLEAN NOT NULL DEFAULT false,
  "marketing_sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
  "anonymized_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_users_phone_key" ON "guest_users"("phone");

CREATE TABLE IF NOT EXISTS "guest_org_memberships" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_org_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_org_memberships_customer_id_key" ON "guest_org_memberships"("customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "guest_org_memberships_guest_user_id_organization_id_key" ON "guest_org_memberships"("guest_user_id", "organization_id");
CREATE INDEX IF NOT EXISTS "guest_org_memberships_organization_id_idx" ON "guest_org_memberships"("organization_id");

CREATE TABLE IF NOT EXISTS "guest_devices" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "fcm_token" TEXT NOT NULL,
  "platform" TEXT,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_devices_fcm_token_key" ON "guest_devices"("fcm_token");
CREATE INDEX IF NOT EXISTS "guest_devices_guest_user_id_idx" ON "guest_devices"("guest_user_id");

CREATE TABLE IF NOT EXISTS "guest_addresses" (
  "id" TEXT NOT NULL,
  "guest_user_id" TEXT NOT NULL,
  "label" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "guest_addresses_guest_user_id_idx" ON "guest_addresses"("guest_user_id");

CREATE TABLE IF NOT EXISTS "guest_phone_otps" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "challenge_token" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_phone_otps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_phone_otps_challenge_token_key" ON "guest_phone_otps"("challenge_token");
CREATE INDEX IF NOT EXISTS "guest_phone_otps_phone_idx" ON "guest_phone_otps"("phone");
CREATE INDEX IF NOT EXISTS "guest_phone_otps_challenge_token_idx" ON "guest_phone_otps"("challenge_token");

ALTER TABLE "delivery_orders"
  ADD COLUMN IF NOT EXISTS "pincode" TEXT,
  ADD COLUMN IF NOT EXISTS "zone_id" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "delivery_orders_status_idx" ON "delivery_orders"("status");

ALTER TABLE "guest_org_memberships"
  ADD CONSTRAINT "guest_org_memberships_guest_user_id_fkey"
  FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_org_memberships"
  ADD CONSTRAINT "guest_org_memberships_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_org_memberships"
  ADD CONSTRAINT "guest_org_memberships_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_devices"
  ADD CONSTRAINT "guest_devices_guest_user_id_fkey"
  FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_addresses"
  ADD CONSTRAINT "guest_addresses_guest_user_id_fkey"
  FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

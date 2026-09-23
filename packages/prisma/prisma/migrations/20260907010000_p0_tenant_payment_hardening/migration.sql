-- P0 tenant consistency + payment webhook idempotency

-- Brand: composite unique for FK targets
CREATE UNIQUE INDEX IF NOT EXISTS "brands_id_organization_id_key" ON "brands"("id", "organization_id");

-- Outlet: composite unique + brand must belong to same organization
CREATE UNIQUE INDEX IF NOT EXISTS "outlets_id_organization_id_key" ON "outlets"("id", "organization_id");

ALTER TABLE "outlets" DROP CONSTRAINT IF EXISTS "outlets_brand_id_fkey";
ALTER TABLE "outlets"
  ADD CONSTRAINT "outlets_brand_id_organization_id_fkey"
  FOREIGN KEY ("brand_id", "organization_id")
  REFERENCES "brands"("id", "organization_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Order: outlet must belong to same organization
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_outlet_id_fkey";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_outlet_id_organization_id_fkey"
  FOREIGN KEY ("outlet_id", "organization_id")
  REFERENCES "outlets"("id", "organization_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Payment: denormalized organization_id for tenant-scoped queries
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

UPDATE "payments" p
SET "organization_id" = o."organization_id"
FROM "orders" o
WHERE p."order_id" = o."id"
  AND (p."organization_id" IS NULL OR p."organization_id" = '');

DELETE FROM "payments" WHERE "organization_id" IS NULL;

ALTER TABLE "payments" ALTER COLUMN "organization_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_organization_id_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payments_organization_id_created_at_idx"
  ON "payments"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "payments_organization_id_status_idx"
  ON "payments"("organization_id", "status");

-- Idempotent webhook event ledger
CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_provider_event_id_key"
  ON "payment_webhook_events"("provider", "event_id");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_provider_event_type_idx"
  ON "payment_webhook_events"("provider", "event_type");

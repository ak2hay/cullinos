-- Guest App Ops portal schema additions
-- Apply with: npx prisma db push --schema packages/prisma/prisma/schema.prisma
-- (or prisma migrate deploy after creating a formal migration)

ALTER TABLE "outlets"
  ADD COLUMN IF NOT EXISTS "marketplace_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "marketplace_featured_rank" INTEGER,
  ADD COLUMN IF NOT EXISTS "marketplace_moderation_status" TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "marketplace_unlisted_by_platform" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "guest_outlet_reviews"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS "moderated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "moderated_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "moderation_note" TEXT;

CREATE INDEX IF NOT EXISTS "guest_outlet_reviews_status_created_at_idx"
  ON "guest_outlet_reviews"("status", "created_at");

ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "marketplace_featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "guest_push_campaigns"
  ADD COLUMN IF NOT EXISTS "audience_filter" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "deep_link" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failed_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "guest_push_campaigns_status_scheduled_at_idx"
  ON "guest_push_campaigns"("status", "scheduled_at");

CREATE TABLE IF NOT EXISTS "guest_discover_sections" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_discover_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "guest_discover_sections_is_active_sort_order_idx"
  ON "guest_discover_sections"("is_active", "sort_order");

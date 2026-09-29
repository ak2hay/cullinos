-- Guest marketing: banners, push campaigns, richer coupons

ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

CREATE TABLE IF NOT EXISTS "guest_banners" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'organization',
  "organization_id" TEXT,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "image_url" TEXT,
  "link_type" TEXT NOT NULL DEFAULT 'none',
  "link_payload" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "guest_banners_scope_is_active_sort_order_idx"
  ON "guest_banners"("scope", "is_active", "sort_order");
CREATE INDEX IF NOT EXISTS "guest_banners_organization_id_is_active_idx"
  ON "guest_banners"("organization_id", "is_active");

DO $$ BEGIN
  ALTER TABLE "guest_banners"
    ADD CONSTRAINT "guest_banners_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "guest_push_campaigns" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'organization',
  "organization_id" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "audience" TEXT NOT NULL DEFAULT 'org_members',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "sent_at" TIMESTAMP(3),
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_push_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "guest_push_campaigns_scope_created_at_idx"
  ON "guest_push_campaigns"("scope", "created_at");
CREATE INDEX IF NOT EXISTS "guest_push_campaigns_organization_id_created_at_idx"
  ON "guest_push_campaigns"("organization_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "guest_push_campaigns"
    ADD CONSTRAINT "guest_push_campaigns_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

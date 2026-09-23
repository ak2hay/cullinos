-- Phase 5 Growth MVP

CREATE TYPE "ReservationStatus" AS ENUM ('pending', 'confirmed', 'seated', 'cancelled', 'no_show');

ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "zone" TEXT;

CREATE INDEX IF NOT EXISTS "outlets_zone_idx" ON "outlets"("zone");
CREATE INDEX IF NOT EXISTS "outlets_state_idx" ON "outlets"("state");

CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT,
    "party_size" INTEGER NOT NULL,
    "reserved_at" TIMESTAMP(3) NOT NULL,
    "table_id" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "booking_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservations_booking_token_key" ON "reservations"("booking_token");
CREATE INDEX "reservations_outlet_id_reserved_at_idx" ON "reservations"("outlet_id", "reserved_at");
CREATE INDEX "reservations_organization_id_status_idx" ON "reservations"("organization_id", "status");

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sms_campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'sending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sms_campaigns_organization_id_created_at_idx" ON "sms_campaigns"("organization_id", "created_at");

ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "feedback_responses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "survey_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feedback_responses_order_id_key" ON "feedback_responses"("order_id");
CREATE UNIQUE INDEX "feedback_responses_survey_token_key" ON "feedback_responses"("survey_token");
CREATE INDEX "feedback_responses_outlet_id_created_at_idx" ON "feedback_responses"("outlet_id", "created_at");

ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "promo_display_slides" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "image_url" TEXT,
    "slide_type" TEXT NOT NULL DEFAULT 'offer',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "duration_seconds" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_display_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promo_display_slides_outlet_id_is_active_sort_order_idx" ON "promo_display_slides"("outlet_id", "is_active", "sort_order");

ALTER TABLE "promo_display_slides" ADD CONSTRAINT "promo_display_slides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promo_display_slides" ADD CONSTRAINT "promo_display_slides_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

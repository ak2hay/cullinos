-- AlterTable
ALTER TABLE "guest_push_campaigns" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "guest_push_campaigns" ADD COLUMN IF NOT EXISTS "style_preset" TEXT;
ALTER TABLE "guest_push_campaigns" ADD COLUMN IF NOT EXISTS "creative" JSONB NOT NULL DEFAULT '{}';

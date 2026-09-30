-- AlterTable
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3);
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "suspend_reason" TEXT;

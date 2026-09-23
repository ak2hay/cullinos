-- Guest login PIN (bcrypt hash via @cullinos/auth)
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "pin_hash" TEXT;
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "pin_updated_at" TIMESTAMP(3);

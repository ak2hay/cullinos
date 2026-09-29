-- Scope phone OTP challenges so a customer OTP cannot be redeemed on the staff login path
ALTER TABLE "phone_otps" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'customer_login';
CREATE INDEX IF NOT EXISTS "phone_otps_organization_id_created_at_idx" ON "phone_otps" ("organization_id", "created_at");

-- SaaS plan change keeps the paid plan until the new gateway subscription charges
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_plan_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_razorpay_sub_id" TEXT;

-- Per-phone guest PIN lockout
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "pin_failed_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "pin_locked_until" TIMESTAMP(3);

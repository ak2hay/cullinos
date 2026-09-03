-- Razorpay diner + SaaS subscription identifiers

ALTER TABLE "organizations" ADD COLUMN "razorpay_customer_id" TEXT;

ALTER TABLE "plans" ADD COLUMN "razorpay_plan_id_monthly" TEXT;

ALTER TABLE "subscriptions" ADD COLUMN "razorpay_short_url" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "last_razorpay_payment_id" TEXT;

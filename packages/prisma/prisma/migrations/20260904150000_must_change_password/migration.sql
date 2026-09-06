-- AlterTable
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- Soften user FKs so tenant hard-delete can cascade cleanly
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_created_by_id_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cashier_shifts" DROP CONSTRAINT IF EXISTS "cashier_shifts_outlet_id_fkey";
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cashier_shifts" DROP CONSTRAINT IF EXISTS "cashier_shifts_user_id_fkey";
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

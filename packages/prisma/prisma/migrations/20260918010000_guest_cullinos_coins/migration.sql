-- AlterTable
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "cullinos_coins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "guest_coin_ledger" (
    "id" TEXT NOT NULL,
    "guest_user_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_coin_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "guest_coin_ledger_guest_user_id_created_at_idx" ON "guest_coin_ledger"("guest_user_id", "created_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "guest_coin_ledger" ADD CONSTRAINT "guest_coin_ledger_guest_user_id_fkey" FOREIGN KEY ("guest_user_id") REFERENCES "guest_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

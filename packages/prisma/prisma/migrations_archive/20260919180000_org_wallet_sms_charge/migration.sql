-- Org prepaid wallet for SMS / metered addons
CREATE TYPE "WalletLedgerType" AS ENUM ('topup', 'sms_charge', 'manual_credit', 'manual_debit', 'refund');

CREATE TABLE IF NOT EXISTS "organization_wallets" (
    "organization_id" TEXT NOT NULL,
    "balance_paise" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_wallets_pkey" PRIMARY KEY ("organization_id")
);

CREATE TABLE IF NOT EXISTS "wallet_ledger_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "WalletLedgerType" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wallet_ledger_entries_organization_id_created_at_idx"
  ON "wallet_ledger_entries"("organization_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_wallets_organization_id_fkey'
  ) THEN
    ALTER TABLE "organization_wallets"
      ADD CONSTRAINT "organization_wallets_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_ledger_entries_organization_id_fkey'
  ) THEN
    ALTER TABLE "wallet_ledger_entries"
      ADD CONSTRAINT "wallet_ledger_entries_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organization_wallets"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "charged_paise" INTEGER NOT NULL DEFAULT 0;

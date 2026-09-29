-- Add WhatsApp e-bill wallet ledger type (metered like SMS campaigns)
ALTER TYPE "WalletLedgerType" ADD VALUE IF NOT EXISTS 'whatsapp_charge';

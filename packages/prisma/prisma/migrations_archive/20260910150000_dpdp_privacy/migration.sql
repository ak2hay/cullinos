-- DPDP: customer marketing consent, guest anonymization, consent registry, impersonation handoff

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "marketing_email_opt_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "marketing_sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "marketing_opt_in_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "marketing_opt_out_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unsubscribe_token" TEXT,
  ADD COLUMN IF NOT EXISTS "anonymized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_unsubscribe_token_key" ON "customers"("unsubscribe_token");
CREATE INDEX IF NOT EXISTS "customers_organization_id_marketing_email_opt_in_idx" ON "customers"("organization_id", "marketing_email_opt_in");
CREATE INDEX IF NOT EXISTS "customers_anonymized_at_idx" ON "customers"("anonymized_at");

ALTER TABLE "guests"
  ADD COLUMN IF NOT EXISTS "anonymized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "guests_organization_id_anonymized_at_idx" ON "guests"("organization_id", "anonymized_at");

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "notice_version" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawn_at" TIMESTAMP(3),
  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consent_records_organization_id_subject_type_subject_id_idx"
  ON "consent_records"("organization_id", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "consent_records_purpose_granted_idx"
  ON "consent_records"("purpose", "granted");

DO $$ BEGIN
  ALTER TABLE "consent_records"
    ADD CONSTRAINT "consent_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "impersonation_handoffs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "target_user_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "access_token" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "impersonation_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "impersonation_handoffs_code_hash_key" ON "impersonation_handoffs"("code_hash");
CREATE INDEX IF NOT EXISTS "impersonation_handoffs_expires_at_idx" ON "impersonation_handoffs"("expires_at");

DO $$ BEGIN
  ALTER TABLE "impersonation_handoffs"
    ADD CONSTRAINT "impersonation_handoffs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "environment_class" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sandbox_skip_email_otp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sandbox_skip_sms_otp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sandbox_relax_password" BOOLEAN NOT NULL DEFAULT true;

-- Existing orgs stay Live (1); defaults already apply
UPDATE "organizations" SET "environment_class" = 1 WHERE "environment_class" IS NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "super_admin_sql_audits" (
    "id" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "sql_preview" TEXT NOT NULL,
    "row_count" INTEGER,
    "duration_ms" INTEGER,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_sql_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "super_admin_sql_audits_created_at_idx" ON "super_admin_sql_audits"("created_at");

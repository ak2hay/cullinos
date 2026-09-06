-- CreateTable
CREATE TABLE "phone_otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "challenge_token" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "phone_otps_challenge_token_key" ON "phone_otps"("challenge_token");
CREATE INDEX "phone_otps_phone_organization_id_idx" ON "phone_otps"("phone", "organization_id");
CREATE INDEX "phone_otps_challenge_token_idx" ON "phone_otps"("challenge_token");

-- Unique phone per org (nullable phones allowed multiple NULLs in Postgres)
CREATE UNIQUE INDEX "customers_organization_id_phone_key" ON "customers"("organization_id", "phone");

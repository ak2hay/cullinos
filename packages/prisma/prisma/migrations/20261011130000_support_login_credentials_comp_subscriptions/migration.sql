-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "is_complimentary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "comp_ticket_id" TEXT;

-- CreateTable
CREATE TABLE "support_login_credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_login_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_login_credentials_grant_id_key" ON "support_login_credentials"("grant_id");

-- CreateIndex
CREATE INDEX "support_login_credentials_target_user_id_expires_at_idx" ON "support_login_credentials"("target_user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "support_login_credentials" ADD CONSTRAINT "support_login_credentials_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "tenant_access_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

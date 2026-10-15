-- AlterTable
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "platform_approval_email_tokens" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_approval_email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_approval_email_tokens_token_hash_key" ON "platform_approval_email_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "platform_approval_email_tokens_request_id_approver_id_idx" ON "platform_approval_email_tokens"("request_id", "approver_id");

-- AddForeignKey
ALTER TABLE "platform_approval_email_tokens" ADD CONSTRAINT "platform_approval_email_tokens_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "platform_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

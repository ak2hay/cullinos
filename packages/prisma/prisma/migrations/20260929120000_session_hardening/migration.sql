-- sessions was never written before this migration; clear any stray rows so family_id can be NOT NULL.
DELETE FROM "sessions";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "family_id" TEXT NOT NULL,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "portal" TEXT,
ADD COLUMN     "replaced_by_id" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "user_agent" TEXT;

-- CreateTable
CREATE TABLE "stored_objects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_key_key" ON "stored_objects"("key");

-- CreateIndex
CREATE INDEX "stored_objects_organization_id_idx" ON "stored_objects"("organization_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

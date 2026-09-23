-- AlterTable
ALTER TABLE "guest_users" ADD COLUMN IF NOT EXISTS "firebase_uid" TEXT;
ALTER TABLE "guest_users" ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "guest_users_firebase_uid_key" ON "guest_users"("firebase_uid");

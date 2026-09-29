-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('owner', 'support', 'sales', 'marketing', 'finance', 'viewer');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "platform_role" "PlatformRole";

-- Existing super admins keep full access.
UPDATE "users" SET "platform_role" = 'owner' WHERE "is_super_admin" = true;

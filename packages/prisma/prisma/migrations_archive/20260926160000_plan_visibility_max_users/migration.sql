-- CreateEnum
CREATE TYPE "PlanVisibility" AS ENUM ('public', 'private');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN "max_users" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "plans" ADD COLUMN "visibility" "PlanVisibility" NOT NULL DEFAULT 'public';

-- CreateIndex
CREATE INDEX "plans_visibility_is_active_idx" ON "plans"("visibility", "is_active");

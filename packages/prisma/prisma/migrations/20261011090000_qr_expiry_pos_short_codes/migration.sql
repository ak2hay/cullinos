-- AlterTable
ALTER TABLE "table_sessions" ADD COLUMN     "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "stale_alerted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "short_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_organization_id_short_code_key" ON "menu_items"("organization_id", "short_code");

-- CreateIndex
CREATE INDEX "table_sessions_status_last_activity_at_idx" ON "table_sessions"("status", "last_activity_at");

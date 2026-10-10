-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN "satisfaction" INTEGER,
ADD COLUMN "satisfaction_comment" TEXT,
ADD COLUMN "closed_reason" TEXT;

-- AlterTable
ALTER TABLE "support_ticket_comments" ADD COLUMN "from_customer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_slug_key" ON "knowledge_articles"("slug");

-- CreateIndex
CREATE INDEX "knowledge_articles_published_category_idx" ON "knowledge_articles"("published", "category");

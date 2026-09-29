-- CreateTable
CREATE TABLE "marketing_inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "outlets" TEXT,
    "plan_interest" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_inquiries_status_created_at_idx" ON "marketing_inquiries"("status", "created_at");

-- CreateIndex
CREATE INDEX "marketing_inquiries_created_at_idx" ON "marketing_inquiries"("created_at");

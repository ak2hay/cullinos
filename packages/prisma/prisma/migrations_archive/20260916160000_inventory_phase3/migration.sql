-- CreateEnum
CREATE TYPE "CentralKitchenIndentStatus" AS ENUM ('pending', 'approved', 'fulfilled', 'cancelled');

-- AlterTable: wastage tenant scoping
ALTER TABLE "wastage" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "wastage" ADD COLUMN "outlet_id" TEXT;

UPDATE "wastage" w
SET "organization_id" = ii."organization_id"
FROM "inventory_items" ii
WHERE w."inventory_item_id" = ii."id" AND w."organization_id" IS NULL;

UPDATE "wastage" w
SET "outlet_id" = ii."outlet_id"
FROM "inventory_items" ii
WHERE w."inventory_item_id" = ii."id" AND w."outlet_id" IS NULL;

ALTER TABLE "wastage" ALTER COLUMN "organization_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "central_kitchens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "central_kitchens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "central_kitchen_outlets" (
    "id" TEXT NOT NULL,
    "central_kitchen_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,

    CONSTRAINT "central_kitchen_outlets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "central_kitchen_indents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "central_kitchen_id" TEXT NOT NULL,
    "requesting_outlet_id" TEXT NOT NULL,
    "status" "CentralKitchenIndentStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "central_kitchen_indents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "central_kitchen_indent_items" (
    "id" TEXT NOT NULL,
    "indent_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "central_kitchen_indent_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "central_kitchens_outlet_id_key" ON "central_kitchens"("outlet_id");
CREATE INDEX "central_kitchens_organization_id_idx" ON "central_kitchens"("organization_id");
CREATE UNIQUE INDEX "central_kitchen_outlets_central_kitchen_id_outlet_id_key" ON "central_kitchen_outlets"("central_kitchen_id", "outlet_id");
CREATE INDEX "central_kitchen_indents_central_kitchen_id_status_idx" ON "central_kitchen_indents"("central_kitchen_id", "status");
CREATE INDEX "central_kitchen_indents_requesting_outlet_id_status_idx" ON "central_kitchen_indents"("requesting_outlet_id", "status");
CREATE INDEX "wastage_organization_id_recorded_at_idx" ON "wastage"("organization_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "wastage" ADD CONSTRAINT "wastage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wastage" ADD CONSTRAINT "wastage_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wastage" ADD CONSTRAINT "wastage_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "central_kitchens" ADD CONSTRAINT "central_kitchens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "central_kitchens" ADD CONSTRAINT "central_kitchens_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "central_kitchen_outlets" ADD CONSTRAINT "central_kitchen_outlets_central_kitchen_id_fkey" FOREIGN KEY ("central_kitchen_id") REFERENCES "central_kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "central_kitchen_outlets" ADD CONSTRAINT "central_kitchen_outlets_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "central_kitchen_indents" ADD CONSTRAINT "central_kitchen_indents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "central_kitchen_indents" ADD CONSTRAINT "central_kitchen_indents_central_kitchen_id_fkey" FOREIGN KEY ("central_kitchen_id") REFERENCES "central_kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "central_kitchen_indents" ADD CONSTRAINT "central_kitchen_indents_requesting_outlet_id_fkey" FOREIGN KEY ("requesting_outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "central_kitchen_indent_items" ADD CONSTRAINT "central_kitchen_indent_items_indent_id_fkey" FOREIGN KEY ("indent_id") REFERENCES "central_kitchen_indents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "central_kitchen_indent_items" ADD CONSTRAINT "central_kitchen_indent_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
